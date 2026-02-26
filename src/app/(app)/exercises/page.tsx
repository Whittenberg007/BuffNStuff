import { ExerciseList } from "@/components/exercises/exercise-list";

export default function ExercisesPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Exercise Library</h1>
        <p className="mt-1 text-muted-foreground">
          Browse 200+ exercises by muscle group
        </p>
      </div>
      <ExerciseList />
    </div>
  );
}
