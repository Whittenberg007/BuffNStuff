"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFastingSettings, upsertFastingSettings } from "@/lib/database/fasting";
import { toast } from "sonner";
import type { FastingProtocol } from "@/types";

const PROTOCOLS: { value: FastingProtocol; label: string; fastH: number; eatH: number }[] = [
  { value: "12:12", label: "12:12 — Beginner", fastH: 12, eatH: 12 },
  { value: "14:10", label: "14:10 — Moderate", fastH: 14, eatH: 10 },
  { value: "16:8", label: "16:8 — Most Popular", fastH: 16, eatH: 8 },
  { value: "18:6", label: "18:6 — Advanced", fastH: 18, eatH: 6 },
  { value: "20:4", label: "20:4 — Warrior", fastH: 20, eatH: 4 },
  { value: "23:1", label: "OMAD — One Meal", fastH: 23, eatH: 1 },
  { value: "custom", label: "Custom", fastH: 16, eatH: 8 },
];

export function FastingSettings() {
  const [protocol, setProtocol] = useState<FastingProtocol>("16:8");
  const [targetFastHours, setTargetFastHours] = useState(16);
  const [windowStart, setWindowStart] = useState("12:00");
  const [windowEnd, setWindowEnd] = useState("20:00");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const settings = await getFastingSettings();
        if (settings) {
          setProtocol(settings.protocol);
          setTargetFastHours(settings.target_fast_hours);
          setWindowStart(settings.eating_window_start);
          setWindowEnd(settings.eating_window_end);
          setNotificationsEnabled(settings.notifications_enabled);
        }
      } catch {
        // Use defaults
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function handleProtocolChange(value: FastingProtocol) {
    setProtocol(value);
    const preset = PROTOCOLS.find((p) => p.value === value);
    if (preset && value !== "custom") {
      setTargetFastHours(preset.fastH);
      // Auto-calculate window based on a default start of noon minus eat hours
      const eatHours = preset.eatH;
      // Default: eating window centered around midday
      const startHour = Math.max(0, 12 - Math.floor(eatHours / 2));
      const endHour = startHour + eatHours;
      setWindowStart(`${startHour.toString().padStart(2, "0")}:00`);
      setWindowEnd(`${endHour.toString().padStart(2, "0")}:00`);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await upsertFastingSettings({
        protocol,
        target_fast_hours: targetFastHours,
        eating_window_start: windowStart,
        eating_window_end: windowEnd,
        notifications_enabled: notificationsEnabled,
      });
      toast.success("Fasting settings saved");
    } catch (err) {
      console.error("Failed to save fasting settings:", err);
      toast.error("Failed to save fasting settings");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fasting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fasting</CardTitle>
        <CardDescription>
          Configure your intermittent fasting protocol and eating window
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Protocol selector */}
        <div className="space-y-2">
          <Label>Protocol</Label>
          <Select value={protocol} onValueChange={(v) => handleProtocolChange(v as FastingProtocol)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROTOCOLS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom fast hours (only for custom protocol) */}
        {protocol === "custom" && (
          <div className="space-y-2">
            <Label htmlFor="fast-hours">Target Fast Hours</Label>
            <Input
              id="fast-hours"
              type="number"
              min={1}
              max={23}
              value={targetFastHours}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n) && n >= 1 && n <= 23) setTargetFastHours(n);
              }}
            />
          </div>
        )}

        {/* Eating window times */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="window-start">Window Opens</Label>
            <Input
              id="window-start"
              type="time"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="window-end">Window Closes</Label>
            <Input
              id="window-end"
              type="time"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
            />
          </div>
        </div>

        {/* Notifications toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="size-4 rounded border-border accent-primary"
          />
          <span className="text-muted-foreground">Enable fasting notifications</span>
        </label>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Fasting Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
