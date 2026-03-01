"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProgramBuilder } from "@/components/programs/program-builder";

export default function NewProgramPage() {
  const router = useRouter();

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
        <h1 className="text-2xl font-bold">Create Custom Program</h1>
        <p className="text-muted-foreground text-sm">
          Build a personalized training program from scratch.
        </p>
      </div>

      {/* Program Builder */}
      <ProgramBuilder onCreated={() => router.push("/programs")} />
    </div>
  );
}
