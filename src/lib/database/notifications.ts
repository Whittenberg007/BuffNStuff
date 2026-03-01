import { createClient } from "@/lib/supabase/client";
import type {
  AppNotification,
  NotificationPreferences,
  NotificationType,
} from "@/types";

// Social notification types that respect social_notifications preference
const SOCIAL_TYPES: NotificationType[] = [
  "follow_request",
  "follow_accepted",
  "reaction_received",
  "challenge_invite",
];

// Achievement notification types that respect achievement_alerts preference
const ACHIEVEMENT_TYPES: NotificationType[] = [
  "pr_hit",
  "badge_earned",
  "streak_milestone",
  "goal_completed",
  "challenge_won",
];

// Fetch notification preferences for the current user, creating defaults if none exist
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Try to fetch existing preferences
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (data) return data as NotificationPreferences;

  // If no row exists (PGRST116 = no rows returned), insert defaults
  if (error && error.code === "PGRST116") {
    const { data: newPrefs, error: insertError } = await supabase
      .from("notification_preferences")
      .insert({
        user_id: user.id,
        workout_reminders: true,
        social_notifications: true,
        achievement_alerts: true,
        reminder_time: "09:00",
        reminder_days: [1, 3, 5],
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return newPrefs as NotificationPreferences;
  }

  // Any other error
  if (error) throw error;

  // Should never reach here, but satisfy TypeScript
  throw new Error("Unexpected state fetching notification preferences");
}

// Update notification preferences for the current user
export async function updateNotificationPreferences(
  updates: Partial<
    Pick<
      NotificationPreferences,
      | "workout_reminders"
      | "social_notifications"
      | "achievement_alerts"
      | "reminder_time"
      | "reminder_days"
    >
  >
): Promise<NotificationPreferences> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("notification_preferences")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as NotificationPreferences;
}

// Create a notification, respecting the user's preference settings
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: AppNotification["data"];
}): Promise<AppNotification | null> {
  const supabase = createClient();

  // Fetch the target user's notification preferences
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", params.userId)
    .single();

  if (prefs) {
    // Skip social notifications if user has them disabled
    if (
      SOCIAL_TYPES.includes(params.type) &&
      !prefs.social_notifications
    ) {
      return null;
    }

    // Skip achievement notifications if user has them disabled
    if (
      ACHIEVEMENT_TYPES.includes(params.type) &&
      !prefs.achievement_alerts
    ) {
      return null;
    }
  }

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as AppNotification;
}

// Fetch notifications for the current user with pagination
export async function getNotifications(
  limit = 50,
  offset = 0
): Promise<AppNotification[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

// Get the count of unread notifications for the current user
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) throw error;
  return count ?? 0;
}

// Mark a single notification as read
export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) throw error;
}

// Mark all notifications as read for the current user
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) throw error;
}

// Delete a notification by id
export async function deleteNotification(
  notificationId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) throw error;
}

// Schedule local workout reminders on native platforms
export async function scheduleWorkoutReminders(
  reminderTime: string,
  reminderDays: number[]
): Promise<void> {
  // Dynamic import to avoid loading Capacitor on web
  const { isNative } = await import("@/lib/capacitor/platform");
  if (!isNative()) return;

  const { cancelAllLocalNotifications, scheduleLocalNotification } =
    await import("@/lib/capacitor/notifications");

  // Cancel all existing local notifications before rescheduling
  await cancelAllLocalNotifications();

  const [hours, minutes] = reminderTime.split(":").map(Number);
  const now = new Date();

  for (const day of reminderDays) {
    // Calculate the next occurrence of this day-of-week
    const target = new Date(now);
    const currentDay = now.getDay(); // 0 = Sunday
    let daysUntil = day - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0) {
      // Same day: only schedule if the time hasn't passed yet
      const todayTarget = new Date(now);
      todayTarget.setHours(hours, minutes, 0, 0);
      if (todayTarget <= now) {
        daysUntil = 7;
      }
    }

    target.setDate(now.getDate() + daysUntil);
    target.setHours(hours, minutes, 0, 0);

    await scheduleLocalNotification({
      title: "Time to train!",
      body: "Your scheduled workout is waiting. Let's go!",
      id: 1000 + day,
      scheduleAt: target,
    });
  }
}
