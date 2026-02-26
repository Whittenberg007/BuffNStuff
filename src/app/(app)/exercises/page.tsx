import { ExerciseList } from "@/components/exercises/exercise-list";
import Link from "next/link";

export default function ExercisesPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Exercise Library</h1>
        <p className="mt-1 text-muted-foreground">
          Browse 200+ exercises by muscle group
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href="/exercises"
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors bg-primary text-primary-foreground"
          >
            Library
          </Link>
          <Link
            href="/exercises/clips"
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Clips
          </Link>
        </div>
      </div>
      <ExerciseList />
    </div>
  );
}
