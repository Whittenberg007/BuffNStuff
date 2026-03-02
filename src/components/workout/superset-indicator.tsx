"use client";

import { Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SupersetLinkButtonProps {
  isLinked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function SupersetLinkButton({
  isLinked,
  onToggle,
  disabled = false,
}: SupersetLinkButtonProps) {
  return (
    <Button
      variant={isLinked ? "default" : "ghost"}
      size="icon-xs"
      onClick={onToggle}
      disabled={disabled}
      title={isLinked ? "Unlink superset" : "Link as superset with next exercise"}
    >
      {isLinked ? (
        <Link2Off className="size-3.5" />
      ) : (
        <Link2 className="size-3.5" />
      )}
    </Button>
  );
}

export function SupersetConnector() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5">
        <Link2 className="size-3 text-primary" />
        <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
          Superset
        </span>
      </div>
    </div>
  );
}
