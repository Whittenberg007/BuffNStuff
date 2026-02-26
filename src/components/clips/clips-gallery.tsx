"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ClipCard } from "./clip-card";
import { YouTubePlayer } from "./youtube-player";
import { getClips, deleteClip } from "@/lib/database/clips";
import { extractVideoId, formatSeconds } from "@/lib/youtube/utils";
import type { ExerciseClip, MuscleGroup, ClipType } from "@/types";
import { Plus, Search, Loader2, Film } from "lucide-react";

const MUSCLE_GROUP_OPTIONS: { value: MuscleGroup | "all"; label: string }[] = [
  { value: "all", label: "All Muscles" },
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

const CLIP_TYPE_OPTIONS: { value: ClipType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "form", label: "Form" },
  { value: "tip", label: "Tip" },
  { value: "motivation", label: "Motivation" },
  { value: "workout", label: "Workout" },
];

export function ClipsGallery() {
  const [clips, setClips] = useState<ExerciseClip[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | "all">("all");
  const [clipType, setClipType] = useState<ClipType | "all">("all");
  const [creatorSearch, setCreatorSearch] = useState("");
  const [debouncedCreator, setDebouncedCreator] = useState("");

  // Playback dialog
  const [playingClip, setPlayingClip] = useState<ExerciseClip | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search inputs
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creatorDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(query);
    }, 300);
  }, []);

  const handleCreatorChange = useCallback((query: string) => {
    setCreatorSearch(query);
    if (creatorDebounceTimer.current)
      clearTimeout(creatorDebounceTimer.current);
    creatorDebounceTimer.current = setTimeout(() => {
      setDebouncedCreator(query);
    }, 300);
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (creatorDebounceTimer.current)
        clearTimeout(creatorDebounceTimer.current);
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, []);

  // Fetch clips when filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getClips({
      muscleGroup: muscleGroup === "all" ? undefined : muscleGroup,
      clipType: clipType === "all" ? undefined : clipType,
      creatorName: debouncedCreator || undefined,
      search: debouncedSearch || undefined,
    })
      .then((data) => {
        if (!cancelled) setClips(data);
      })
      .catch(() => {
        if (!cancelled) setClips([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [muscleGroup, clipType, debouncedCreator, debouncedSearch]);

  const handleClipClick = useCallback((clip: ExerciseClip) => {
    setPlayingClip(clip);
    setDialogOpen(true);
  }, []);

  const handlePlayerReady = useCallback(
    (player: YT.Player) => {
      if (playingClip) {
        player.seekTo(playingClip.start_seconds, true);
        player.playVideo();

        // Stop at end time
        if (previewTimeoutRef.current)
          clearTimeout(previewTimeoutRef.current);
        const clipDuration =
          (playingClip.end_seconds - playingClip.start_seconds) * 1000;
        previewTimeoutRef.current = setTimeout(() => {
          try {
            player.pauseVideo();
          } catch {
            // Player might be destroyed
          }
        }, clipDuration);
      }
    },
    [playingClip]
  );

  const handleDelete = useCallback(
    async (clip: ExerciseClip) => {
      try {
        await deleteClip(clip.id);
        setClips((prev) => prev.filter((c) => c.id !== clip.id));
      } catch {
        // Error handling
      }
    },
    []
  );

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      setPlayingClip(null);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clips..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={muscleGroup}
          onValueChange={(value) =>
            setMuscleGroup(value as MuscleGroup | "all")
          }
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All Muscles" />
          </SelectTrigger>
          <SelectContent>
            {MUSCLE_GROUP_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={clipType}
          onValueChange={(value) => setClipType(value as ClipType | "all")}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {CLIP_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Creator..."
          value={creatorSearch}
          onChange={(e) => handleCreatorChange(e.target.value)}
          className="w-full sm:w-[140px]"
        />

        <Button asChild size="sm">
          <Link href="/exercises/clips/new">
            <Plus className="size-4" />
            New Clip
          </Link>
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : clips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Film className="size-12 text-muted-foreground/40" />
          <p className="mt-3 text-lg font-medium text-muted-foreground">
            No clips yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Save some exercise tips from YouTube!
          </p>
          <Button asChild className="mt-4" variant="secondary">
            <Link href="/exercises/clips/new">
              <Plus className="size-4" />
              Create Your First Clip
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {clips.length} clip{clips.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onClick={handleClipClick}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}

      {/* Playback Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          {playingClip && (
            <>
              <DialogHeader className="p-4 pb-0">
                <DialogTitle className="text-base">
                  {playingClip.title}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {playingClip.creator_name && (
                    <span>{playingClip.creator_name} &middot; </span>
                  )}
                  {formatSeconds(playingClip.start_seconds)} &ndash;{" "}
                  {formatSeconds(playingClip.end_seconds)}
                </DialogDescription>
              </DialogHeader>
              <div className="px-4 pb-4">
                {(() => {
                  const vid = extractVideoId(playingClip.youtube_url);
                  if (!vid) return null;
                  return (
                    <YouTubePlayer
                      videoId={vid}
                      onReady={handlePlayerReady}
                    />
                  );
                })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
