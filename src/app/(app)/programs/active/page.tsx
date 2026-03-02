"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getActiveEnrollment,
  advanceProgram,
  abandonProgram,
} from "@/lib/database/programs";
import { WeekView } from "@/components/programs/week-view";
import type { ProgramEnrollment } from "@/types";

export default function ActiveProgramPage() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<ProgramEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [abandoning, setAbandoning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getActiveEnrollment();
        if (!cancelled) setEnrollment(data);
      } catch (err) {
        console.error("Failed to load enrollment:", err);
        if (!cancelled) setEnrollment(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDayComplete() {
    if (!enrollment) return;
    setAdvancing(true);
    try {
      const updated = await advanceProgram(enrollment.id);
      if (updated.status === "completed") {
        toast.success("Congratulations! You completed the program!");
        router.push("/programs");
      } else {
        setEnrollment(updated);
        toast.success("Day completed! Moving to next session.");
      }
    } catch (err) {
      console.error("Failed to advance program:", err);
      toast.error("Failed to complete day");
    } finally {
      setAdvancing(false);
    }
  }

  async function handleAbandon() {
    if (!enrollment) return;
    const confirmed = window.confirm(
      "Are you sure you want to abandon this program? Your progress will be saved but the program will be marked as abandoned."
    );
    if (!confirmed) return;

    setAbandoning(true);
    try {
      await abandonProgram(enrollment.id);
      toast.success("Program abandoned");
      router.push("/programs");
    } catch (err) {
      console.error("Failed to abandon program:", err);
      toast.error("Failed to abandon program");
      setAbandoning(false);
    }
  }

  if (loading) {
    return <div className="p-4 md:p-8 max-w-4xl mx-auto">Loading...</div>;
  }

  // No active enrollment
  if (!enrollment || !enrollment.program) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <Link
          href="/programs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Programs
        </Link>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No active program
          </p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            You are not currently enrolled in any training program.
          </p>
          <Link href="/programs/browse">
            <Button>
              <Search className="size-4" />
              Browse Programs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const program = enrollment.program;
  const totalWeeks = program.duration_weeks;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/programs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Programs
      </Link>

      {/* Program header */}
      <div>
        <h1 className="text-2xl font-bold">{program.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Week {enrollment.current_week} of {totalWeeks}
        </p>
        {/* Progress bar */}
        <div className="mt-3 w-full bg-zinc-800 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{
              width: `${Math.min(
                100,
                ((enrollment.current_week - 1) / totalWeeks) * 100 +
                  (enrollment.current_day_index /
                    program.days_per_week /
                    totalWeeks) *
                    100
              )}%`,
            }}
          />
        </div>
      </div>

      {/* Week View */}
      {advancing ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <WeekView enrollment={enrollment} onDayComplete={handleDayComplete} />
      )}

      {/* Abandon button */}
      <div className="pt-4 border-t border-zinc-800">
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={handleAbandon}
          disabled={abandoning}
        >
          {abandoning ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Abandoning...
            </>
          ) : (
            "Abandon Program"
          )}
        </Button>
      </div>
    </div>
  );
}
