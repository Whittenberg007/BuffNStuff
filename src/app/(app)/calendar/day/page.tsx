"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DayDetailClient } from "@/components/calendar/day-detail-page-client";

function DayDetailInner() {
  const searchParams = useSearchParams();
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  return <DayDetailClient date={date} />;
}

export default function DayDetailPage() {
  return (
    <Suspense>
      <DayDetailInner />
    </Suspense>
  );
}
