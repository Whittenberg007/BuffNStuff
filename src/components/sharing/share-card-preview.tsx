"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRCard } from "./pr-card";
import { StreakCard } from "./streak-card";
import { SummaryCard } from "./summary-card";
import { FastingCard } from "./fasting-card";
import { captureAndShare } from "@/lib/sharing/progress-cards";
import { getCurrentStreak, getRecentPRs, getWeeklySummary } from "@/lib/database/stats";
import { getFastingStreak, getFastingSettings } from "@/lib/database/fasting";
import { getSettings } from "@/lib/database/settings";
import { toast } from "sonner";

type CardType = "pr" | "streak" | "summary" | "fasting";

export function ShareCardPreview() {
  const [cardType, setCardType] = useState<CardType>("streak");
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  // Data state
  const [prData, setPrData] = useState<{ exercise: string; weight: number; reps: number; date: string } | null>(null);
  const [streakData, setStreakData] = useState(0);
  const [summaryData, setSummaryData] = useState({ workouts: 0, totalVolume: 0, avgCalories: 0, weightChange: "N/A" });
  const [fastingData, setFastingData] = useState({ protocol: "16:8", streak: 0, adherence: 0 });
  const [unit, setUnit] = useState("lbs");

  useEffect(() => {
    async function load() {
      try {
        const [streak, prs, summary, fastingStreak, fastingSettings, settings] = await Promise.all([
          getCurrentStreak(),
          getRecentPRs(30),
          getWeeklySummary(),
          getFastingStreak(),
          getFastingSettings(),
          getSettings(),
        ]);

        setStreakData(streak);
        setUnit(settings?.unit_preference || "lbs");

        if (prs.length > 0) {
          const pr = prs[0];
          setPrData({
            exercise: pr.exerciseName,
            weight: pr.weight,
            reps: pr.reps,
            date: pr.date.split("T")[0],
          });
        }

        setSummaryData({
          workouts: summary.daysThisWeek,
          totalVolume: summary.totalVolume,
          avgCalories: 0,
          weightChange: "N/A",
        });

        setFastingData({
          protocol: fastingSettings?.protocol || "Not set",
          streak: fastingStreak,
          adherence: 0,
        });
      } catch {
        // Use defaults
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function handleShare() {
    const el = cardRef.current?.querySelector("#share-card") as HTMLElement | null;
    if (!el) return;

    setIsSharing(true);
    try {
      await captureAndShare(el, `buffnstuff-${cardType}-${Date.now()}.png`);
      toast.success("Card shared!");
    } catch (err) {
      console.error("Share failed:", err);
      toast.error("Failed to share card");
    } finally {
      setIsSharing(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="size-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Select value={cardType} onValueChange={(v) => setCardType(v as CardType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="streak">Workout Streak</SelectItem>
            {prData && <SelectItem value="pr">Personal Record</SelectItem>}
            <SelectItem value="summary">Weekly Summary</SelectItem>
            <SelectItem value="fasting">Fasting Progress</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Card preview (scaled down for display) */}
      <div ref={cardRef} className="overflow-hidden rounded-lg border" style={{ maxHeight: 400 }}>
        <div style={{ transform: "scale(0.35)", transformOrigin: "top left", width: 1080, height: 1080 }}>
          {cardType === "pr" && prData && (
            <PRCard exercise={prData.exercise} weight={prData.weight} reps={prData.reps} date={prData.date} unit={unit} />
          )}
          {cardType === "streak" && <StreakCard streak={streakData} type="workout" />}
          {cardType === "summary" && (
            <SummaryCard
              workouts={summaryData.workouts}
              totalVolume={summaryData.totalVolume}
              avgCalories={summaryData.avgCalories}
              weightChange={summaryData.weightChange}
              period="This Week"
            />
          )}
          {cardType === "fasting" && (
            <FastingCard protocol={fastingData.protocol} streak={fastingData.streak} adherencePercent={fastingData.adherence} />
          )}
        </div>
      </div>

      <Button onClick={handleShare} disabled={isSharing} className="w-full gap-2">
        {isSharing ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
        {isSharing ? "Sharing..." : "Share Card"}
      </Button>
    </div>
  );
}
