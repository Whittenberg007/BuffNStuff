interface PRCardProps {
  exercise: string;
  weight: number;
  reps: number;
  date: string;
  unit: string;
}

export function PRCard({ exercise, weight, reps, date, unit }: PRCardProps) {
  return (
    <div
      id="share-card"
      className="flex flex-col items-center justify-center w-[1080px] h-[1080px] bg-zinc-950 text-white p-16"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="w-full h-full rounded-3xl bg-gradient-to-br from-green-900/40 to-zinc-900 border border-green-500/20 flex flex-col items-center justify-center p-16 relative">
        <p className="text-green-400 text-3xl font-medium tracking-wider uppercase mb-4">
          New Personal Record!
        </p>
        <p className="text-7xl font-bold mb-6">{exercise}</p>
        <p className="text-8xl font-black tabular-nums">
          {weight} {unit} × {reps}
        </p>
        <p className="text-2xl text-zinc-400 mt-8">{date}</p>
        <p className="absolute bottom-8 right-12 text-xl text-zinc-600 font-medium">BuffNStuff</p>
      </div>
    </div>
  );
}
