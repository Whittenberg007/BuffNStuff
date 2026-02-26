"use client";

import Link from "next/link";
import { Dumbbell, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function TodayWorkout() {
  return (
    <Card className="border-primary/20 bg-primary/5 py-4">
      <CardContent className="px-4">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Dumbbell className="size-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Ready to train?</p>
            <p className="text-sm text-muted-foreground">
              Start a workout or pick from your templates.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/workout">
                <Dumbbell className="size-4" />
                Start Workout
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/workout/templates">
                <LayoutTemplate className="size-4" />
                Templates
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
