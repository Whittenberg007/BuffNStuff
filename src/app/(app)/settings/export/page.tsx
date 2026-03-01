"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ExportPanel } from "@/components/export/export-panel";
import { BackupRestore } from "@/components/export/backup-restore";

export default function ExportPage() {
  const router = useRouter();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Data Export</h1>
          <p className="text-sm text-muted-foreground">Export, backup, and restore your data</p>
        </div>
      </div>

      <ExportPanel />
      <BackupRestore />
    </div>
  );
}
