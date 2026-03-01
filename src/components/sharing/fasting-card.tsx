interface FastingCardProps {
  protocol: string;
  streak: number;
  adherencePercent: number;
}

export function FastingCard({ protocol, streak, adherencePercent }: FastingCardProps) {
  return (
    <div
      id="share-card"
      className="flex flex-col items-center justify-center w-[1080px] h-[1080px] bg-zinc-950 text-white p-16"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="w-full h-full rounded-3xl bg-gradient-to-br from-purple-900/40 to-zinc-900 border border-purple-500/20 flex flex-col items-center justify-center p-16 relative">
        <p className="text-purple-400 text-3xl font-medium tracking-wider uppercase mb-6">
          Intermittent Fasting
        </p>
        <p className="text-8xl font-black mb-4">{protocol}</p>
        <div className="flex gap-16 mt-8">
          <div className="text-center">
            <p className="text-7xl font-black tabular-nums">{streak}</p>
            <p className="text-xl text-zinc-400 mt-2">Day Streak</p>
          </div>
          <div className="text-center">
            <p className="text-7xl font-black tabular-nums">{adherencePercent}%</p>
            <p className="text-xl text-zinc-400 mt-2">Adherence</p>
          </div>
        </div>
        <p className="absolute bottom-8 right-12 text-xl text-zinc-600 font-medium">BuffNStuff</p>
      </div>
    </div>
  );
}
