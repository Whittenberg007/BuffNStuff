"use client";

import { useEffect, useState } from "react";
import { getSettings } from "@/lib/database/settings";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { TrainingSettings } from "@/components/settings/training-settings";
import { NutritionSettings } from "@/components/settings/nutrition-settings";
import { TDEECalculator } from "@/components/settings/tdee-calculator";
import type { UserSettings } from "@/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getSettings();
        setSettings(data);
      } catch (err) {
        console.error("Failed to load settings:", err);
        setError("Failed to load settings. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  function handleSettingsUpdated(updated: UserSettings) {
    setSettings(updated);
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-destructive">
          {error || "Unable to load settings"}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your profile, training, and nutrition preferences
        </p>
      </div>

      <ProfileSettings
        settings={settings}
        onSettingsUpdated={handleSettingsUpdated}
      />

      <TrainingSettings
        settings={settings}
        onSettingsUpdated={handleSettingsUpdated}
      />

      <NutritionSettings
        settings={settings}
        onSettingsUpdated={handleSettingsUpdated}
      />

      <TDEECalculator
        settings={settings}
        onSettingsUpdated={handleSettingsUpdated}
      />
    </div>
  );
}
