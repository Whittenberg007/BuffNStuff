interface StreakCardProps {
  streak: number;
  type: "workout" | "fasting";
}

export function StreakCard({ streak, type }: StreakCardProps) {
  return (
    <div
      id="share-card"
      className="flex flex-col items-center justify-center w-[1080px] h-[1080px] bg-zinc-950 text-white p-16"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="w-full h-full rounded-3xl bg-gradient-to-br from-orange-900/40 to-zinc-900 border border-orange-500/20 flex flex-col items-center justify-center p-16 relative">
        <p className="text-9xl mb-4">🔥</p>
        <p className="text-[10rem] font-black tabular-nums leading-none">{streak}</p>
        <p className="text-4xl font-medium text-orange-300 mt-4">
          Day {type === "workout" ? "Workout" : "Fasting"} Streak
        </p>
        <p className="absolute bottom-8 right-12 text-xl text-zinc-600 font-medium">BuffNStuff</p>
      </div>
    </div>
  );
}
