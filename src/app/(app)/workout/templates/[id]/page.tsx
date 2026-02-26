"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTemplateWithExercises } from "@/lib/database/templates";
import { TemplateBuilder } from "@/components/workout/template-builder";
import type { WorkoutTemplate, TemplateExercise } from "@/types";

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getTemplateWithExercises(params.id);
        if (!cancelled) {
          setTemplate(data.template);
          setExercises(data.exercises);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-muted-foreground mb-2">
          Template not found
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          This template may have been deleted.
        </p>
        <Button
          variant="outline"
          onClick={() => router.push("/workout/templates")}
        >
          Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <TemplateBuilder
        existingTemplate={template}
        existingExercises={exercises}
      />
    </div>
  );
}
