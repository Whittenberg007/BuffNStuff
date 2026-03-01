"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ShareCardPreview } from "@/components/sharing/share-card-preview";

export default function SharePage() {
  const router = useRouter();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Share Progress</h1>
          <p className="text-sm text-muted-foreground">Create and share progress cards</p>
        </div>
      </div>

      <ShareCardPreview />
    </div>
  );
}
