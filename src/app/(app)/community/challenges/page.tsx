"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { getChallenges } from "@/lib/database/challenges";
import { ChallengeCard } from "@/components/challenges/challenge-card";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Challenge, ChallengeStatus } from "@/types";

const TABS: { label: string; status: ChallengeStatus }[] = [
  { label: "Active", status: "active" },
  { label: "Upcoming", status: "upcoming" },
  { label: "Completed", status: "completed" },
];

export default function ChallengesPage() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeTab, setActiveTab] = useState<ChallengeStatus>("active");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getChallenges();
        setChallenges(data);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const filtered = challenges.filter((c) => c.status === activeTab);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="text-center py-8 text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/community">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Challenges</h1>
        </div>
        <Link href="/community/challenges/new">
          <Button size="sm">
            <Plus className="size-4 mr-1" />
            Create Challenge
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.status}
            variant={activeTab === tab.status ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.status)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Challenge list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No {activeTab} challenges
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onView={() =>
                router.push(`/community/challenges/view?id=${challenge.id}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
