"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EquipmentType } from "@/types";

const equipmentOptions: { value: EquipmentType | "all"; label: string }[] = [
  { value: "all", label: "All Equipment" },
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "cable", label: "Cable" },
  { value: "machine", label: "Machine" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "band", label: "Band" },
  { value: "other", label: "Other" },
];

interface ExerciseFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedEquipment: EquipmentType | "all";
  onEquipmentChange: (equipment: EquipmentType | "all") => void;
}

export function ExerciseFilters({
  searchQuery,
  onSearchChange,
  selectedEquipment,
  onEquipmentChange,
}: ExerciseFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search exercises..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select
        value={selectedEquipment}
        onValueChange={(value) =>
          onEquipmentChange(value as EquipmentType | "all")
        }
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Equipment" />
        </SelectTrigger>
        <SelectContent>
          {equipmentOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
