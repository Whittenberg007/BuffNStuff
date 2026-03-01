"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getActiveEnrollment,
  getEnrollmentHistory,
  getUserPrograms,
} from "@/lib/database/programs";
import { ProgramCard } from "@/components/programs/program-card";
import type { TrainingProgram, ProgramEnrollment } from "@/types";

export default function ProgramsPage() {
  const [activeEnrollment, setActiveEnrollment] =
    useState<ProgramEnrollment | null>(null);
  const [userPrograms, setUserPrograms] = useState<TrainingProgram[]>([]);
  const [history, setHistory] = useState<ProgramEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [enrollment, programs, enrollmentHistory] = await Promise.all([
          getActiveEnrollment(),
          getUserPrograms(),
          getEnrollmentHistory(),
        ]);

        if (!cancelled) {
          setActiveEnrollment(enrollment);
          setUserPrograms(programs);
          // Filter history to only completed/abandoned (not active)
          setHistory(
            enrollmentHistory.filter((e) => e.status !== "active")
          );
        }
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

  if (loading) {
    return <div className="p-4 md:p-8 max-w-4xl mx-auto">Loading...</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">My Programs</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your training programs, browse pre-built options, or create
          your own.
        </p>
      </div>

      {/* Active Enrollment */}
      {activeEnrollment && activeEnrollment.program && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Active Program
          </h2>
          <Link href="/programs/active">
            <Card className="py-4 cursor-pointer transition-all hover:shadow-md border-emerald-500/50">
              <CardContent className="px-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {activeEnrollment.program.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-0 bg-emerald-900 text-emerald-200 text-[10px]"
                  >
                    Active
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Week {activeEnrollment.current_week} of{" "}
                  {activeEnrollment.program.duration_weeks} &middot; Day{" "}
                  {activeEnrollment.current_day_index + 1} of{" "}
                  {activeEnrollment.program.days_per_week}
                </p>
              </CardContent>
            </Card>
          </Link>
        </section>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Link href="/programs/new">
          <Button variant="outline">
            <Plus className="size-4" />
            Create Custom Program
          </Button>
        </Link>
        <Link href="/programs/browse">
          <Button variant="outline">
            <Search className="size-4" />
            Browse Pre-Built Programs
          </Button>
        </Link>
      </div>

      {/* User's Custom Programs */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          My Custom Programs
        </h2>
        {userPrograms.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            You haven&apos;t created any custom programs yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userPrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                enrolled={
                  activeEnrollment?.program_id === program.id
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Enrollment History */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Program History
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No program history yet.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((enrollment) => (
              <Card key={enrollment.id} className="py-3">
                <CardContent className="px-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {enrollment.program?.name ?? "Unknown Program"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        Week {enrollment.current_week} of{" "}
                        {enrollment.program?.duration_weeks ?? "?"}
                      </p>
                    </div>
                    {enrollment.status === "completed" ? (
                      <Badge
                        variant="outline"
                        className="border-0 bg-emerald-900 text-emerald-200 text-[10px]"
                      >
                        <CheckCircle2 className="size-3 mr-0.5" />
                        Completed
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-0 bg-zinc-800 text-zinc-400 text-[10px]"
                      >
                        <XCircle className="size-3 mr-0.5" />
                        Abandoned
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
