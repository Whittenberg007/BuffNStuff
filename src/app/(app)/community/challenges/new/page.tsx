"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ChallengeForm } from "@/components/challenges/challenge-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Challenge } from "@/types";

export default function NewChallengePage() {
  const router = useRouter();

  function handleCreated(challenge: Challenge) {
    router.push(`/community/challenges/view?id=${challenge.id}`);
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/community/challenges">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Create Challenge</h1>
      </div>

      {/* Form */}
      <ChallengeForm onCreated={handleCreated} />
    </div>
  );
}
