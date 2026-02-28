import { AppShell } from "@/components/layout/app-shell";
import { CapacitorAuthGuard } from "@/components/capacitor/auth-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CapacitorAuthGuard>
      <AppShell>{children}</AppShell>
    </CapacitorAuthGuard>
  );
}
