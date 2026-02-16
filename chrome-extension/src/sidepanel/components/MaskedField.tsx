import { Lock } from 'lucide-react';

interface MaskedFieldProps {
  label: string;
  value: string | null | undefined;
  masked?: boolean;
}

function maskValue(value: string): string {
  if (value.includes('@')) {
    // Email: show first 2 chars and domain
    const [local, domain] = value.split('@');
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(3, local.length - 2))}@${domain}`;
  }
  // Phone: show last 4 digits
  if (value.replace(/\D/g, '').length >= 7) {
    const digits = value.replace(/\D/g, '');
    return `***-***-${digits.slice(-4)}`;
  }
  return value;
}

export function MaskedField({ label, value, masked = true }: MaskedFieldProps) {
  if (!value) return null;

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {masked && <Lock className="h-3 w-3 text-muted-foreground" />}
        <span className="text-xs font-medium">{masked ? maskValue(value) : value}</span>
      </div>
    </div>
  );
}
