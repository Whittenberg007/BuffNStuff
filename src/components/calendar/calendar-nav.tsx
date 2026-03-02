"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarView = "month" | "week";

interface CalendarNavProps {
  title: string;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarNav({
  title,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
}: CalendarNavProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onPrev}>
            <ChevronLeft className="size-5" />
          </Button>
          <button
            onClick={onToday}
            className="text-lg font-semibold hover:underline min-w-[10rem] text-center"
          >
            {title}
          </button>
          <Button variant="ghost" size="icon" onClick={onNext}>
            <ChevronRight className="size-5" />
          </Button>
        </div>

        <div className="flex rounded-lg border bg-muted p-0.5">
          <button
            onClick={() => onViewChange("month")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
              view === "month"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Month
          </button>
          <button
            onClick={() => onViewChange("week")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
              view === "week"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Week
          </button>
        </div>
      </div>
    </div>
  );
}
