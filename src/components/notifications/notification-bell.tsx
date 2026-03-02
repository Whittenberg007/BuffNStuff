"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadNotificationCount } from "@/lib/database/notifications";

export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const count = await getUnreadNotificationCount();
        setUnread(count);
      } catch {
        // Silently handle errors
      }
    }

    fetchCount();

    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link href="/notifications" className="relative inline-flex items-center">
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center size-5 rounded-full bg-red-500 text-xs text-white font-medium">
          {unread}
        </span>
      )}
    </Link>
  );
}
