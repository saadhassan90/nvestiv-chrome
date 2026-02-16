import { MaterialIcon } from './MaterialIcon';

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  inferred?: boolean;
}

export function StatCard({ label, value, subtitle, inferred = false }: StatCardProps) {
  return (
    <div className={inferred ? 'stat-card-inferred' : 'stat-card'}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex justify-between">
        {label}
        {inferred && (
          <MaterialIcon name="warning" className="text-amber-500 text-[14px]" />
        )}
      </div>
      <div className="text-xl sm:text-2xl font-sans font-bold text-slate-900 mb-1 leading-tight break-words">
        {value}
      </div>
      {subtitle && (
        <div className={`text-xs font-medium ${inferred ? 'text-amber-600' : 'text-slate-500'}`}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
