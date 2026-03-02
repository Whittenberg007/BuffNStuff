import { BottomNav } from "./bottom-nav";
import { SidebarNav } from "./sidebar-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <SidebarNav />
      <main className="relative flex-1 overflow-auto pb-20 md:pb-0">
        <div className="absolute top-4 right-4 z-40">
          <NotificationBell />
        </div>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
