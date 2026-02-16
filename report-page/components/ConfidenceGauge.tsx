interface ConfidenceGaugeProps {
  score: number;
  totalSources: number;
}

export function ConfidenceGauge({ score, totalSources }: ConfidenceGaugeProps) {
  // Clamp to 0-100
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
      <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          {/* Background track */}
          <path
            className="text-slate-200"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          {/* Filled arc */}
          <path
            className="text-slate-900"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeDasharray={`${clamped}, 100`}
            strokeWidth="2.5"
          />
        </svg>
        <span className="absolute text-xs font-bold text-slate-900">{clamped}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
          Confidence Score
        </span>
        <span className="text-[10px] text-slate-500">
          Based on {totalSources} verified data points
        </span>
      </div>
    </div>
  );
}
