"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { UserSearch } from "@/components/community/user-search";
import Link from "next/link";

export default function FindUsersPage() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/community">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Find Friends</h1>
          <p className="text-sm text-muted-foreground">
            Search by username or enter a friend code
          </p>
        </div>
      </div>

      <UserSearch />
    </div>
  );
}
