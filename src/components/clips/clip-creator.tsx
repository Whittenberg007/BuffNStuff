"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { YouTubePlayer } from "./youtube-player";
import { TimelineSelector } from "./timeline-selector";
import { extractVideoId, getThumbnailUrl } from "@/lib/youtube/utils";
import { createClip } from "@/lib/database/clips";
import { getExercises } from "@/lib/database/exercises";
import type { Exercise, MuscleGroup, ClipType } from "@/types";
import {
  Link2,
  Save,
  Loader2,
  ArrowLeft,
  ImageIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "biceps", label: "Biceps" },
  { value: "triceps", label: "Triceps" },
  { value: "quads", label: "Quads" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "glutes", label: "Glutes" },
  { value: "calves", label: "Calves" },
  { value: "core", label: "Core" },
  { value: "forearms", label: "Forearms" },
];

const CLIP_TYPES: { value: ClipType; label: string }[] = [
  { value: "form", label: "Form" },
  { value: "tip", label: "Tip" },
  { value: "motivation", label: "Motivation" },
  { value: "workout", label: "Workout" },
];

const CREATOR_SUGGESTIONS = [
  "Ryan Humiston",
  "Jeff Nippard",
  "Dr. Mike Israetel",
  "Jeff Cavaliere",
  "Jeremy Ethier",
];

export function ClipCreator() {
  const router = useRouter();

  // URL & video state
  const [urlInput, setUrlInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Player state
  const playerRef = useRef<YT.Player | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Metadata state
  const [title, setTitle] = useState("");
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<
    MuscleGroup[]
  >([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null
  );
  const [creatorName, setCreatorName] = useState("");
  const [clipType, setClipType] = useState<ClipType>("form");
  const [showCreatorSuggestions, setShowCreatorSuggestions] = useState(false);

  // Exercise list
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);

  // Load exercises on mount
  useEffect(() => {
    getExercises()
      .then(setExercises)
      .catch(() => setExercises([]));
  }, []);

  // Cleanup preview timeout
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, []);

  const handleUrlSubmit = useCallback(() => {
    const id = extractVideoId(urlInput);
    if (id) {
      setVideoId(id);
      setUrlError(null);
    } else {
      setUrlError("Invalid YouTube URL. Supported: youtube.com/watch, youtu.be, youtube.com/shorts");
      setVideoId(null);
    }
  }, [urlInput]);

  const handlePlayerReady = useCallback((player: YT.Player) => {
    playerRef.current = player;
    const dur = player.getDuration();
    setDuration(dur);
    setEndTime(dur);
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleSetStartFromPlayback = useCallback(() => {
    if (playerRef.current) {
      const time = playerRef.current.getCurrentTime();
      setStartTime(time);
      if (time >= endTime) {
        setEndTime(Math.min(time + 30, duration));
      }
    }
  }, [endTime, duration]);

  const handleSetEndFromPlayback = useCallback(() => {
    if (playerRef.current) {
      const time = playerRef.current.getCurrentTime();
      setEndTime(time);
      if (time <= startTime) {
        setStartTime(Math.max(0, time - 30));
      }
    }
  }, [startTime]);

  const handlePreviewClip = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.seekTo(startTime, true);
      playerRef.current.playVideo();

      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      const clipDuration = (endTime - startTime) * 1000;
      previewTimeoutRef.current = setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.pauseVideo();
        }
      }, clipDuration);
    }
  }, [startTime, endTime]);

  const toggleMuscleGroup = useCallback((group: MuscleGroup) => {
    setSelectedMuscleGroups((prev) =>
      prev.includes(group)
        ? prev.filter((g) => g !== group)
        : [...prev, group]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!videoId || !title.trim() || selectedMuscleGroups.length === 0) return;

    setSaving(true);
    try {
      await createClip({
        youtube_url: urlInput,
        start_seconds: Math.floor(startTime),
        end_seconds: Math.floor(endTime),
        title: title.trim(),
        muscle_groups: selectedMuscleGroups,
        exercise_id: selectedExerciseId,
        creator_name: creatorName.trim() || null,
        clip_type: clipType,
        thumbnail_url: getThumbnailUrl(videoId),
      });
      router.push("/exercises/clips");
    } catch {
      // Error handling - could show toast here
    } finally {
      setSaving(false);
    }
  }, [
    videoId,
    urlInput,
    title,
    selectedMuscleGroups,
    selectedExerciseId,
    creatorName,
    clipType,
    startTime,
    endTime,
    router,
  ]);

  const filteredSuggestions = CREATOR_SUGGESTIONS.filter(
    (s) =>
      creatorName.length > 0 &&
      s.toLowerCase().includes(creatorName.toLowerCase()) &&
      s.toLowerCase() !== creatorName.toLowerCase()
  );

  const isValid =
    videoId && title.trim() && selectedMuscleGroups.length > 0 && endTime > startTime;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/exercises/clips"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Clips
      </Link>

      {/* URL Input */}
      <div className="space-y-2">
        <Label>YouTube URL</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setUrlError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUrlSubmit();
              }}
              className="pl-9"
            />
          </div>
          <Button onClick={handleUrlSubmit} variant="secondary">
            Load
          </Button>
        </div>
        {urlError && (
          <p className="text-sm text-destructive">{urlError}</p>
        )}
      </div>

      {/* Video Player */}
      {videoId && (
        <>
          <YouTubePlayer
            videoId={videoId}
            onReady={handlePlayerReady}
            onTimeUpdate={handleTimeUpdate}
          />

          {/* Timeline Selector */}
          {duration > 0 && (
            <TimelineSelector
              duration={duration}
              startTime={startTime}
              endTime={endTime}
              currentTime={currentTime}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
              onSetStartFromPlayback={handleSetStartFromPlayback}
              onSetEndFromPlayback={handleSetEndFromPlayback}
              onPreviewClip={handlePreviewClip}
            />
          )}

          {/* Thumbnail Preview */}
          <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getThumbnailUrl(videoId)}
                alt="Video thumbnail"
                className="size-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ImageIcon className="size-3" />
                Thumbnail preview
              </div>
              <p className="mt-0.5 text-sm font-medium truncate">
                {title || "Untitled clip"}
              </p>
            </div>
          </div>

          {/* Metadata Form */}
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>
                Clip Title <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g., Proper Bench Press Form"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Muscle Groups */}
            <div className="space-y-1.5">
              <Label>
                Muscle Groups <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.map((group) => {
                  const isSelected = selectedMuscleGroups.includes(group.value);
                  return (
                    <button
                      key={group.value}
                      type="button"
                      onClick={() => toggleMuscleGroup(group.value)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      {group.label}
                      {isSelected && (
                        <X className="ml-1 inline size-3" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Exercise (optional) */}
            <div className="space-y-1.5">
              <Label>Linked Exercise (optional)</Label>
              <Select
                value={selectedExerciseId ?? "none"}
                onValueChange={(value) =>
                  setSelectedExerciseId(value === "none" ? null : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an exercise..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {exercises.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Creator Name */}
            <div className="relative space-y-1.5">
              <Label>Creator Name</Label>
              <Input
                placeholder="e.g., Jeff Nippard"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                onFocus={() => setShowCreatorSuggestions(true)}
                onBlur={() =>
                  // Delay to allow clicking suggestions
                  setTimeout(() => setShowCreatorSuggestions(false), 200)
                }
              />
              {showCreatorSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                  {filteredSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCreatorName(suggestion);
                        setShowCreatorSuggestions(false);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clip Type */}
            <div className="space-y-1.5">
              <Label>Clip Type</Label>
              <Select
                value={clipType}
                onValueChange={(value) => setClipType(value as ClipType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIP_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="w-full"
            size="lg"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save Clip
              </>
            )}
          </Button>
        </>
      )}

      {/* Empty state when no video loaded */}
      {!videoId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Link2 className="size-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Paste a YouTube URL above to get started
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Supports youtube.com/watch, youtu.be, and youtube.com/shorts
          </p>
        </div>
      )}
    </div>
  );
}
