"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatSeconds } from "@/lib/youtube/utils";
import type { ExerciseClip, ClipType } from "@/types";
import { Play, Pencil, Trash2, Clock, User } from "lucide-react";

const clipTypeColors: Record<ClipType, string> = {
  form: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  tip: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  motivation:
    "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  workout:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ClipCardProps {
  clip: ExerciseClip;
  onClick: (clip: ExerciseClip) => void;
  onDelete: (clip: ExerciseClip) => void;
}

export function ClipCard({ clip, onClick, onDelete }: ClipCardProps) {
  const clipDuration = clip.end_seconds - clip.start_seconds;

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/30">
      {/* Thumbnail with play overlay */}
      <button
        onClick={() => onClick(clip)}
        className="relative block w-full aspect-video overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {clip.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnail_url}
            alt={clip.title}
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted">
            <Play className="size-8 text-muted-foreground" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
          <div className="size-12 rounded-full bg-black/60 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="size-5 text-white ml-0.5" />
          </div>
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2">
          <Badge
            variant="secondary"
            className="bg-black/70 text-white border-0 text-[10px] font-mono"
          >
            <Clock className="size-2.5" />
            {formatSeconds(clipDuration)}
          </Badge>
        </div>
      </button>

      {/* Content */}
      <div className="p-3 space-y-2">
        <h3 className="text-sm font-semibold leading-tight line-clamp-2">
          {clip.title}
        </h3>

        {clip.creator_name && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="size-3" />
            {clip.creator_name}
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 border-0",
              clipTypeColors[clip.clip_type]
            )}
          >
            {capitalize(clip.clip_type)}
          </Badge>
          {clip.muscle_groups.slice(0, 2).map((group) => (
            <Badge
              key={group}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {capitalize(group)}
            </Badge>
          ))}
          {clip.muscle_groups.length > 2 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              +{clip.muscle_groups.length - 2}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-1 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(clip);
            }}
            title="Delete clip"
          >
            <Trash2 className="size-3 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
