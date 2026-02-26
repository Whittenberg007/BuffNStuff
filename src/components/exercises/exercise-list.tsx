"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { MuscleGroupTabs } from "./muscle-group-tabs";
import { ExerciseFilters } from "./exercise-filters";
import { ExerciseCard } from "./exercise-card";
import { ExerciseDetail } from "./exercise-detail";
import { getExercises } from "@/lib/database/exercises";
import type { Exercise, MuscleGroup, EquipmentType } from "@/types";

export function ExerciseList() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<
    MuscleGroup | "all"
  >("all");
  const [selectedEquipment, setSelectedEquipment] = useState<
    EquipmentType | "all"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);

  // Debounce search input by 300ms
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(query);
    }, 300);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // Fetch exercises when filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getExercises({
      muscleGroup:
        selectedMuscleGroup === "all" ? undefined : selectedMuscleGroup,
      equipmentType:
        selectedEquipment === "all" ? undefined : selectedEquipment,
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
  }, [selectedMuscleGroup, selectedEquipment, debouncedSearch]);

  const handleExerciseClick = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <MuscleGroupTabs
        selected={selectedMuscleGroup}
        onSelect={setSelectedMuscleGroup}
      />

      <ExerciseFilters
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedEquipment={selectedEquipment}
        onEquipmentChange={setSelectedEquipment}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No exercises found
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your filters or search query.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {exercises.length} exercise{exercises.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onClick={handleExerciseClick}
              />
            ))}
          </div>
        </>
      )}

      <ExerciseDetail
        exercise={selectedExercise}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
