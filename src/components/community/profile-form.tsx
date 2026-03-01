"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import {
  checkUsernameAvailable,
  createProfile,
  updateProfile,
} from "@/lib/database/profiles";
import { toast } from "sonner";
import type { UserProfile } from "@/types";

interface ProfileFormProps {
  existingProfile?: UserProfile | null;
  onSaved: (profile: UserProfile) => void;
}

const USERNAME_REGEX = /^[a-z0-9_]+$/;

export function ProfileForm({ existingProfile, onSaved }: ProfileFormProps) {
  const isEditing = !!existingProfile;

  const [username, setUsername] = useState(existingProfile?.username || "");
  const [displayName, setDisplayName] = useState(
    existingProfile?.display_name || ""
  );
  const [bio, setBio] = useState(existingProfile?.bio || "");
  const [isPublic, setIsPublic] = useState(
    existingProfile?.is_public || false
  );
  const [isSaving, setIsSaving] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  function validateUsername(value: string): string {
    if (value.length < 3) return "Must be at least 3 characters";
    if (value.length > 20) return "Must be 20 characters or less";
    if (!USERNAME_REGEX.test(value))
      return "Only lowercase letters, numbers, and underscores";
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedUsername = username.toLowerCase().trim();

    const validationError = validateUsername(normalizedUsername);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing) {
        const updated = await updateProfile(existingProfile.id, {
          display_name: displayName || null,
          bio: bio || null,
          is_public: isPublic,
        });
        toast.success("Profile updated!");
        onSaved(updated);
      } else {
        // Check username availability
        const available = await checkUsernameAvailable(normalizedUsername);
        if (!available) {
          setUsernameError("Username already taken");
          return;
        }

        const created = await createProfile({
          username: normalizedUsername,
          display_name: displayName || undefined,
          bio: bio || undefined,
          is_public: isPublic,
        });
        toast.success("Profile created!");
        onSaved(created);
      }
    } catch (err) {
      console.error("Profile save failed:", err);
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Username (only editable on creation) */}
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => {
            const val = e.target.value.toLowerCase();
            setUsername(val);
            setUsernameError(val ? validateUsername(val) : "");
          }}
          placeholder="your_username"
          disabled={isEditing}
          maxLength={20}
        />
        {usernameError && (
          <p className="text-sm text-destructive">{usernameError}</p>
        )}
        {!isEditing && (
          <p className="text-xs text-muted-foreground">
            3-20 characters, lowercase letters, numbers, and underscores only.
            Cannot be changed later.
          </p>
        )}
      </div>

      {/* Display name */}
      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your Display Name"
          maxLength={50}
        />
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell us about your fitness journey..."
          maxLength={160}
          rows={3}
        />
        <p className="text-xs text-muted-foreground text-right">
          {bio.length}/160
        </p>
      </div>

      {/* Public toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="isPublic">Public Profile</Label>
          <p className="text-xs text-muted-foreground">
            Anyone can see your profile and follow without approval
          </p>
        </div>
        <Switch
          id="isPublic"
          checked={isPublic}
          onCheckedChange={setIsPublic}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSaving}>
        {isSaving && <Loader2 className="size-4 animate-spin mr-2" />}
        {isEditing ? "Update Profile" : "Create Profile"}
      </Button>
    </form>
  );
}
