"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getTemplates, getTemplateWithExercises } from "@/lib/database/templates";
import { startWorkoutSession } from "@/lib/database/workouts";
import type { WorkoutTemplate } from "@/types";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export function TemplatePicker() {
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getTemplates()
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartFromTemplate = async (templateId: string) => {
    setStartingId(templateId);
    try {
      // Get template details for split type and training style
      const { template, exercises } =
        await getTemplateWithExercises(templateId);

      // Create session linked to template
      const session = await startWorkoutSession({
        templateId: template.id,
        splitType: template.split_type,
        trainingStyle: template.training_style,
      });

      // Build a query param with exercise IDs so the active page can pre-load them
      const exerciseIds = exercises
        .map((te) => te.exercise_id)
        .join(",");

      router.push(
        `/workout/active?sessionId=${session.id}&exerciseIds=${exerciseIds}`
      );
    } catch (err) {
      console.error("Failed to start workout from template:", err);
      toast.error("Failed to start workout");
      setStartingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No templates yet — create one in{" "}
          <a
            href="/workout/templates"
            className="font-medium text-primary underline underline-offset-4"
          >
            Templates
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {templates.map((template) => (
        <Card key={template.id} className="relative">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{template.name}</CardTitle>
            {template.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {template.description}
              </p>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5 mb-3">
              <Badge variant="secondary" className="text-[10px]">
                {capitalize(template.split_type)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {capitalize(template.training_style)}
              </Badge>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={() => handleStartFromTemplate(template.id)}
              disabled={startingId === template.id}
            >
              {startingId === template.id ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Starting...
                </>
              ) : (
                <>
                  <Play className="size-4" /> Start
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
