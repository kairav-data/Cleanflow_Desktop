import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const IST_TIME_ZONE = 'Asia/Kolkata';

const ISO_WITH_TIMEZONE = /([zZ]|[+-]\d{2}:\d{2})$/;
const ISO_LIKE_VALUE = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/;

const istFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

export function parseUtcDateTime(
  value: string | number | Date | null | undefined,
): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const normalized = trimmed.includes(' ') && !trimmed.includes('T')
      ? trimmed.replace(' ', 'T')
      : trimmed;

    const shouldTreatAsUtc =
      ISO_LIKE_VALUE.test(normalized) && !ISO_WITH_TIMEZONE.test(normalized);

    const parsed = new Date(shouldTreatAsUtc ? `${normalized}Z` : normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTimeInIST(
  value: string | number | Date | null | undefined,
  fallback = '—',
): string {
  const parsed = parseUtcDateTime(value);
  if (!parsed) {
    return typeof value === 'string' && value.trim() ? value : fallback;
  }

  return istFormatter.format(parsed);
}
