"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Dumbbell,
  Loader2,
  Target,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getPrebuiltPrograms, enrollInProgram } from "@/lib/database/programs";
import { ProgramBrowser } from "@/components/programs/program-browser";
import type { TrainingProgram } from "@/types";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export default function BrowseProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgram, setSelectedProgram] =
    useState<TrainingProgram | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getPrebuiltPrograms();
        if (!cancelled) setPrograms(data);
      } catch (err) {
        console.error("Failed to load programs:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnroll() {
    if (!selectedProgram) return;
    setEnrolling(true);
    try {
      await enrollInProgram(selectedProgram.id);
      toast.success(`Enrolled in ${selectedProgram.name}`);
      router.push("/programs/active");
    } catch (err) {
      console.error("Failed to enroll:", err);
      toast.error("Failed to start program");
      setEnrolling(false);
    }
  }

  if (loading) {
    return <div className="p-4 md:p-8 max-w-4xl mx-auto">Loading...</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Back link and header */}
      <div className="space-y-2">
        <Link
          href="/programs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Programs
        </Link>
        <h1 className="text-2xl font-bold">Pre-Built Programs</h1>
        <p className="text-muted-foreground text-sm">
          Browse curated training programs designed by experts.
        </p>
      </div>

      {/* Program Browser with filters */}
      <ProgramBrowser
        programs={programs}
        onSelect={(program) => setSelectedProgram(program)}
      />

      {/* Selected Program Detail */}
      {selectedProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <CardHeader className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3"
                onClick={() => setSelectedProgram(null)}
              >
                <X className="size-4" />
              </Button>
              <CardTitle>{selectedProgram.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Description */}
              {selectedProgram.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedProgram.description}
                </p>
              )}

              {/* Metadata badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  <Target className="size-3 mr-1" />
                  {capitalize(selectedProgram.goal)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {capitalize(selectedProgram.difficulty)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Dumbbell className="size-3 mr-1" />
                  {capitalize(selectedProgram.periodization)}
                </Badge>
              </div>

              {/* Schedule overview */}
              <div className="space-y-1.5">
                <h3 className="text-sm font-medium">Schedule Overview</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {selectedProgram.days_per_week} days/week
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {selectedProgram.duration_weeks} weeks
                  </span>
                </div>

                {/* Week breakdown */}
                {selectedProgram.schedule.weeks.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {selectedProgram.schedule.weeks
                      .slice(0, 3)
                      .map((week) => (
                        <div
                          key={week.week_number}
                          className="text-xs text-muted-foreground"
                        >
                          <span className="font-medium text-foreground">
                            {week.label}
                          </span>
                          {week.is_deload && (
                            <span className="text-amber-400 ml-1">
                              (Deload)
                            </span>
                          )}
                          {" - "}
                          {week.days.map((d) => d.label).join(", ")}
                        </div>
                      ))}
                    {selectedProgram.schedule.weeks.length > 3 && (
                      <p className="text-xs text-zinc-500">
                        +{selectedProgram.schedule.weeks.length - 3} more
                        weeks
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Progression type */}
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Progression</h3>
                <p className="text-xs text-muted-foreground">
                  {capitalize(selectedProgram.progression_rules.type)}
                  {selectedProgram.progression_rules.failure_protocol && (
                    <>
                      {" "}
                      &middot; Failure protocol:{" "}
                      {capitalize(
                        selectedProgram.progression_rules.failure_protocol
                      )}
                    </>
                  )}
                </p>
              </div>

              {/* Enroll button */}
              <Button
                className="w-full"
                onClick={handleEnroll}
                disabled={enrolling}
              >
                {enrolling ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "Start Program"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
