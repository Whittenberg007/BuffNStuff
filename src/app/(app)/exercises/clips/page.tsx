import { ClipsGallery } from "@/components/clips/clips-gallery";
import Link from "next/link";

export default function ClipsPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">Exercise Clips</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Save and organize exercise tips from YouTube
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href="/exercises"
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Library
          </Link>
          <Link
            href="/exercises/clips"
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors bg-primary text-primary-foreground"
          >
            Clips
          </Link>
        </div>
      </div>
      <ClipsGallery />
    </div>
  );
}
