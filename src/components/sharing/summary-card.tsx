interface SummaryCardProps {
  workouts: number;
  totalVolume: number;
  avgCalories: number;
  weightChange: string;
  period: string;
}

export function SummaryCard({ workouts, totalVolume, avgCalories, weightChange, period }: SummaryCardProps) {
  return (
    <div
      id="share-card"
      className="flex flex-col items-center justify-center w-[1080px] h-[1080px] bg-zinc-950 text-white p-16"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="w-full h-full rounded-3xl bg-gradient-to-br from-blue-900/40 to-zinc-900 border border-blue-500/20 flex flex-col items-center justify-center p-16 gap-8 relative">
        <p className="text-blue-400 text-3xl font-medium tracking-wider uppercase">
          {period}
        </p>
        <div className="grid grid-cols-2 gap-8 w-full max-w-2xl">
          {[
            { label: "Workouts", value: workouts.toString() },
            { label: "Volume", value: `${totalVolume.toLocaleString()} lbs` },
            { label: "Avg Calories", value: avgCalories.toString() },
            { label: "Weight", value: weightChange },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-6xl font-black tabular-nums">{stat.value}</p>
              <p className="text-xl text-zinc-400 mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="absolute bottom-8 right-12 text-xl text-zinc-600 font-medium">BuffNStuff</p>
      </div>
    </div>
  );
}
