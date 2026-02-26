import { ClipCreator } from "@/components/clips/clip-creator";

export default function NewClipPage() {
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Clip</h1>
        <p className="mt-1 text-muted-foreground">
          Save a segment from a YouTube video as an exercise reference
        </p>
      </div>
      <ClipCreator />
    </div>
  );
}
