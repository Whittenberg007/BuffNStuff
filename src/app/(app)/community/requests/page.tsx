"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { RequestList } from "@/components/community/request-list";
import Link from "next/link";

export default function RequestsPage() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/community">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Follow Requests</h1>
      </div>

      <RequestList />
    </div>
  );
}
