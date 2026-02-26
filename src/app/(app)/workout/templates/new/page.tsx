"use client";

import { TemplateBuilder } from "@/components/workout/template-builder";

export default function NewTemplatePage() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <TemplateBuilder />
    </div>
  );
}
