"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from "@/lib/database/notifications";
import { NotificationList } from "@/components/notifications/notification-list";
import type { AppNotification } from "@/types";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getNotifications();
        setNotifications(data);
      } catch {
        // silently handle
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // silently handle
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // silently handle
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // silently handle
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Stay up to date</p>
        </div>
        {hasUnread && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="size-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <NotificationList
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onDelete={handleDelete}
      />
    </div>
  );
}
