"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getExercises } from "@/lib/database/exercises";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/types";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ExercisePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: Exercise) => void;
  /** Exercise IDs already in the workout, to show a badge */
  existingExerciseIds?: string[];
}

export function ExercisePickerDialog({
  open,
  onOpenChange,
  onSelect,
  existingExerciseIds = [],
}: ExercisePickerDialogProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(query);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    getExercises({
      search: debouncedSearch || undefined,
    })
      .then((data) => {
        if (!cancelled) setExercises(data);
      })
      .catch(() => {
        if (!cancelled) setExercises([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, debouncedSearch]);

  const handleSelect = (exercise: Exercise) => {
    onSelect(exercise);
    onOpenChange(false);
    setSearchQuery("");
    setDebouncedSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col gap-4 p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Add Exercise</DialogTitle>
          <DialogDescription>
            Search and select an exercise to add to your workout.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
          <div className="px-6 pb-6 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : exercises.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No exercises found
              </p>
            ) : (
              exercises.map((exercise) => {
                const isAlreadyAdded = existingExerciseIds.includes(
                  exercise.id
                );
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => handleSelect(exercise)}
                    className={cn(
                      "w-full text-left rounded-lg p-3 transition-colors",
                      "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isAlreadyAdded && "opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {exercise.name}
                      </span>
                      {isAlreadyAdded && (
                        <Badge variant="secondary" className="text-[10px]">
                          Added
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {capitalize(exercise.primary_muscle_group)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {capitalize(exercise.equipment_type)}
                      </Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
