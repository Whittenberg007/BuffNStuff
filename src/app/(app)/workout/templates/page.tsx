"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  Edit,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getTemplates,
  getTemplateWithExercises,
  deleteTemplate,
} from "@/lib/database/templates";
import type { WorkoutTemplate } from "@/types";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

interface TemplateWithCount extends WorkoutTemplate {
  exerciseCount: number;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutTemplate | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getTemplates();

        // Fetch exercise counts for each template
        const withCounts: TemplateWithCount[] = await Promise.all(
          data.map(async (t) => {
            try {
              const { exercises } = await getTemplateWithExercises(t.id);
              return { ...t, exerciseCount: exercises.length };
            } catch {
              return { ...t, exerciseCount: 0 };
            }
          })
        );

        if (!cancelled) setTemplates(withCounts);
      } catch {
        if (!cancelled) setTemplates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success("Template deleted");
    } catch (err) {
      console.error("Failed to delete template:", err);
      toast.error("Failed to delete template");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Create and manage your workout templates.
          </p>
        </div>
        <Button onClick={() => router.push("/workout/templates/new")}>
          <Plus className="size-4" /> New Template
        </Button>
      </div>

      {/* Templates grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Dumbbell className="size-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            No templates yet
          </p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create your first template to build reusable workout routines.
          </p>
          <Button onClick={() => router.push("/workout/templates/new")}>
            <Plus className="size-4" /> Create Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{template.name}</CardTitle>
                {template.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {capitalize(template.split_type)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {capitalize(template.training_style)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {template.exerciseCount} exercise
                    {template.exerciseCount !== 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      router.push(`/workout/templates/${template.id}`)
                    }
                  >
                    <Edit className="size-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(template)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
