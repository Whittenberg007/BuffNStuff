"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  isHealthSyncAvailable,
  requestHealthPermissions,
} from "@/lib/export/health-sync";
import { toast } from "sonner";

export function HealthSyncSettings() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    isHealthSyncAvailable().then(setAvailable);
  }, []);

  // Don't render while checking or if not available
  if (available === null || !available) return null;

  async function handleConnect() {
    setIsConnecting(true);
    try {
      const result = await requestHealthPermissions();
      if (result) {
        setIsConnected(true);
        toast.success("Connected to Health!");
      } else {
        toast.error("Health permissions not granted");
      }
    } catch {
      toast.error("Failed to connect to Health");
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-5" />
          Health Sync
        </CardTitle>
        <CardDescription>
          Sync workouts, weight, and nutrition to Apple Health or Health Connect
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {isConnected
            ? "Connected — data will auto-sync when you log workouts, weight, or nutrition."
            : "Connect to push your fitness data to your device's health app."}
        </p>
        <Button
          onClick={handleConnect}
          disabled={isConnecting || isConnected}
          variant={isConnected ? "secondary" : "default"}
          className="gap-2"
        >
          {isConnecting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Activity className="size-4" />
          )}
          {isConnected ? "Connected" : isConnecting ? "Connecting..." : "Connect to Health"}
        </Button>
      </CardContent>
    </Card>
  );
}
