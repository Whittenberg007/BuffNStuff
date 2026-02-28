import { isNative } from "./platform";

/** Register for push notifications and return the device token */
export async function registerPushNotifications(): Promise<string | null> {
  if (!isNative()) return null;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return null;

  return new Promise((resolve) => {
    PushNotifications.addListener("registration", (token) => {
      resolve(token.value);
    });

    PushNotifications.addListener("registrationError", () => {
      resolve(null);
    });

    PushNotifications.register();
  });
}

/** Schedule a local notification (e.g., rest timer alert, workout reminder) */
export async function scheduleLocalNotification(options: {
  title: string;
  body: string;
  id?: number;
  scheduleAt?: Date;
}): Promise<void> {
  if (!isNative()) return;

  const { LocalNotifications } = await import("@capacitor/local-notifications");

  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: options.id ?? Date.now(),
        title: options.title,
        body: options.body,
        ...(options.scheduleAt && {
          schedule: { at: options.scheduleAt },
        }),
      },
    ],
  });
}

/** Cancel all pending local notifications */
export async function cancelAllLocalNotifications(): Promise<void> {
  if (!isNative()) return;

  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel(pending);
  }
}
