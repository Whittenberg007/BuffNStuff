"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createChallenge } from "@/lib/database/challenges";
import { toast } from "sonner";
import type { Challenge, ChallengeType } from "@/types";

const CHALLENGE_TYPE_OPTIONS: { value: ChallengeType; label: string }[] = [
  { value: "total_volume", label: "Total Volume (weight \u00d7 reps)" },
  { value: "total_workouts", label: "Most Workouts" },
  { value: "streak", label: "Longest Streak" },
  { value: "total_sets", label: "Most Sets" },
  { value: "total_reps", label: "Most Reps" },
];

interface ChallengeFormProps {
  onCreated: (challenge: Challenge) => void;
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ChallengeForm({ onCreated }: ChallengeFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [challengeType, setChallengeType] = useState<ChallengeType>("total_volume");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const today = getTodayString();
  const maxEndDate = startDate ? addDays(startDate, 90) : "";

  function validate(): string | null {
    if (!title.trim()) return "Title is required.";
    if (title.length > 80) return "Title must be 80 characters or less.";
    if (description.length > 280) return "Description must be 280 characters or less.";
    if (!startDate) return "Start date is required.";
    if (!endDate) return "End date is required.";
    if (endDate <= startDate) return "End date must be after start date.";
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 90) return "Challenge duration cannot exceed 90 days.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setIsSaving(true);
    try {
      const challenge = await createChallenge({
        title: title.trim(),
        description: description.trim() || undefined,
        challenge_type: challengeType,
        start_date: startDate,
        end_date: endDate,
      });
      toast.success("Challenge created!");
      onCreated(challenge);
    } catch (err) {
      console.error("Failed to create challenge:", err);
      toast.error("Failed to create challenge. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectClassName =
    "w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm";
  const dateInputClassName =
    "w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="challenge-title">Title</Label>
          <span className="text-xs text-muted-foreground">
            {title.length}/80
          </span>
        </div>
        <Input
          id="challenge-title"
          placeholder="e.g., March Volume Madness"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          maxLength={80}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="challenge-description">Description (optional)</Label>
          <span className="text-xs text-muted-foreground">
            {description.length}/280
          </span>
        </div>
        <textarea
          id="challenge-description"
          className="border-input dark:bg-input/30 flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Describe what this challenge is about..."
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 280))}
          maxLength={280}
        />
      </div>

      {/* Challenge Type */}
      <div className="space-y-2">
        <Label htmlFor="challenge-type">Challenge Type</Label>
        <select
          id="challenge-type"
          className={selectClassName}
          value={challengeType}
          onChange={(e) => setChallengeType(e.target.value as ChallengeType)}
        >
          {CHALLENGE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Start Date */}
      <div className="space-y-2">
        <Label htmlFor="challenge-start">Start Date</Label>
        <input
          id="challenge-start"
          type="date"
          className={dateInputClassName}
          value={startDate}
          min={today}
          onChange={(e) => {
            setStartDate(e.target.value);
            // Reset end date if it no longer makes sense
            if (endDate && e.target.value >= endDate) {
              setEndDate("");
            }
          }}
          required
        />
      </div>

      {/* End Date */}
      <div className="space-y-2">
        <Label htmlFor="challenge-end">End Date</Label>
        <input
          id="challenge-end"
          type="date"
          className={dateInputClassName}
          value={endDate}
          min={startDate || today}
          max={maxEndDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
          disabled={!startDate}
        />
        {!startDate && (
          <p className="text-xs text-muted-foreground">
            Select a start date first
          </p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isSaving} className="w-full">
        {isSaving ? "Creating..." : "Create Challenge"}
      </Button>
    </form>
  );
}
