"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import {
  updateNotificationPreferences,
  scheduleWorkoutReminders,
} from "@/lib/database/notifications";
import type { NotificationPreferences } from "@/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface NotificationPreferencesProps {
  preferences: NotificationPreferences;
  onUpdated: (prefs: NotificationPreferences) => void;
}

export function NotificationPreferencesPanel({
  preferences,
  onUpdated,
}: NotificationPreferencesProps) {
  const [workoutReminders, setWorkoutReminders] = useState(
    preferences.workout_reminders
  );
  const [socialNotifications, setSocialNotifications] = useState(
    preferences.social_notifications
  );
  const [achievementAlerts, setAchievementAlerts] = useState(
    preferences.achievement_alerts
  );
  const [reminderTime, setReminderTime] = useState(preferences.reminder_time);
  const [reminderDays, setReminderDays] = useState<number[]>(
    preferences.reminder_days
  );

  async function handleToggle(
    field: "workout_reminders" | "social_notifications" | "achievement_alerts",
    checked: boolean
  ) {
    if (field === "workout_reminders") setWorkoutReminders(checked);
    if (field === "social_notifications") setSocialNotifications(checked);
    if (field === "achievement_alerts") setAchievementAlerts(checked);

    try {
      const updated = await updateNotificationPreferences({
        [field]: checked,
      });
      onUpdated(updated);

      if (field === "workout_reminders") {
        if (checked) {
          await scheduleWorkoutReminders(reminderTime, reminderDays);
        } else {
          await scheduleWorkoutReminders(reminderTime, []);
        }
      }
    } catch (err) {
      console.error("Failed to update notification preferences:", err);
      toast.error("Failed to update preferences");
      // Revert local state on error
      if (field === "workout_reminders") setWorkoutReminders(!checked);
      if (field === "social_notifications") setSocialNotifications(!checked);
      if (field === "achievement_alerts") setAchievementAlerts(!checked);
    }
  }

  async function handleReminderTimeChange(time: string) {
    setReminderTime(time);
    try {
      const updated = await updateNotificationPreferences({
        reminder_time: time,
      });
      onUpdated(updated);
      await scheduleWorkoutReminders(time, reminderDays);
    } catch (err) {
      console.error("Failed to update reminder time:", err);
      toast.error("Failed to update reminder time");
    }
  }

  async function handleDayToggle(day: number) {
    const newDays = reminderDays.includes(day)
      ? reminderDays.filter((d) => d !== day)
      : [...reminderDays, day];
    setReminderDays(newDays);

    try {
      const updated = await updateNotificationPreferences({
        reminder_days: newDays,
      });
      onUpdated(updated);
      await scheduleWorkoutReminders(reminderTime, newDays);
    } catch (err) {
      console.error("Failed to update reminder days:", err);
      toast.error("Failed to update reminder days");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-5" />
          Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Workout Reminders */}
        <div className="flex items-center justify-between">
          <Label htmlFor="workout-reminders" className="cursor-pointer">
            Workout Reminders
          </Label>
          <Switch
            id="workout-reminders"
            checked={workoutReminders}
            onCheckedChange={(checked) =>
              handleToggle("workout_reminders", checked)
            }
          />
        </div>

        {/* Workout reminder details (shown when enabled) */}
        {workoutReminders && (
          <div className="space-y-4 pl-1 border-l-2 border-zinc-800 ml-1">
            <div className="space-y-2 pl-3">
              <Label htmlFor="reminder-time">Reminder Time</Label>
              <input
                id="reminder-time"
                type="time"
                value={reminderTime}
                onChange={(e) => handleReminderTimeChange(e.target.value)}
                className="rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2 pl-3">
              <Label>Reminder Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleDayToggle(index)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      reminderDays.includes(index)
                        ? "bg-primary text-primary-foreground"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Social Notifications */}
        <div className="flex items-center justify-between">
          <Label htmlFor="social-notifications" className="cursor-pointer">
            Social Notifications
          </Label>
          <Switch
            id="social-notifications"
            checked={socialNotifications}
            onCheckedChange={(checked) =>
              handleToggle("social_notifications", checked)
            }
          />
        </div>

        {/* Achievement Alerts */}
        <div className="flex items-center justify-between">
          <Label htmlFor="achievement-alerts" className="cursor-pointer">
            Achievement Alerts
          </Label>
          <Switch
            id="achievement-alerts"
            checked={achievementAlerts}
            onCheckedChange={(checked) =>
              handleToggle("achievement_alerts", checked)
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
