"use client";

import { useRef, useState } from "react";
import { Download, Upload, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { createFullBackup, restoreFromBackup } from "@/lib/export/json-export";
import { toast } from "sonner";

export function BackupRestore() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleBackup() {
    setIsBackingUp(true);
    try {
      await createFullBackup();
      toast.success("Full backup created!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setIsBackingUp(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setRestoreSummary(null);
    try {
      const text = await file.text();
      const { restored, skipped } = await restoreFromBackup(text);
      setRestoreSummary(restored);

      const totalRestored = Object.values(restored).reduce((a, b) => a + b, 0);
      const totalSkipped = Object.values(skipped).reduce((a, b) => a + b, 0);

      toast.success(
        `Restored ${totalRestored} records${totalSkipped > 0 ? ` (${totalSkipped} skipped)` : ""}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setIsRestoring(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Backup & Restore
        </CardTitle>
        <CardDescription>
          Create a full backup of all your data or restore from a previous backup
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button onClick={handleBackup} disabled={isBackingUp} variant="outline" className="flex-1 gap-2">
            {isBackingUp ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {isBackingUp ? "Backing up..." : "Create Backup"}
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isRestoring}
            variant="outline"
            className="flex-1 gap-2"
          >
            {isRestoring ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {isRestoring ? "Restoring..." : "Restore from File"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {restoreSummary && (
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-sm font-medium">Restore Complete</p>
            {Object.entries(restoreSummary)
              .filter(([, count]) => count > 0)
              .map(([table, count]) => (
                <p key={table} className="text-xs text-muted-foreground">
                  {table.replace(/_/g, " ")}: {count} records
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
