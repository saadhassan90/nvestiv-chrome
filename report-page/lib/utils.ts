import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getReportAgeDays(generatedAt: string): number {
  return Math.floor(
    (Date.now() - new Date(generatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function getAgeBadgeColor(days: number): string {
  if (days <= 7) return 'bg-report-badge-green text-green-800';
  if (days <= 30) return 'bg-report-badge-yellow text-yellow-800';
  return 'bg-report-badge-red text-red-800';
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
