"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { createClient } from "@/lib/supabase/client";
import { updateSettings } from "@/lib/database/settings";
import { toast } from "sonner";
import type { UserSettings, UnitPreference } from "@/types";

interface ProfileSettingsProps {
  settings: UserSettings;
  onSettingsUpdated: (settings: UserSettings) => void;
}

export function ProfileSettings({
  settings,
  onSettingsUpdated,
}: ProfileSettingsProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(
    settings.display_name || ""
  );
  const [unitPreference, setUnitPreference] = useState<UnitPreference>(
    settings.unit_preference
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const updated = await updateSettings({
        display_name: displayName || null,
        unit_preference: unitPreference,
      });
      onSettingsUpdated(updated);
      toast.success("Profile settings saved");
    } catch (err) {
      console.error("Failed to save profile settings:", err);
      toast.error("Failed to save profile settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      console.error("Failed to sign out:", err);
      toast.error("Failed to sign out");
      setIsSigningOut(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your display name and preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="display-name">Display Name</Label>
          <Input
            id="display-name"
            placeholder="Enter your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Unit Preference</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={unitPreference === "lbs" ? "default" : "outline"}
              size="sm"
              onClick={() => setUnitPreference("lbs")}
            >
              lbs
            </Button>
            <Button
              type="button"
              variant={unitPreference === "kg" ? "default" : "outline"}
              size="sm"
              onClick={() => setUnitPreference("kg")}
            >
              kg
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Profile"}
          </Button>
        </div>

        <div className="border-t pt-4">
          <Button
            variant="outline"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="text-destructive hover:text-destructive"
          >
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
