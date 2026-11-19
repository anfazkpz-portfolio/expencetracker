import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats any date input (YYYY-MM-DD string, ISO string, or Date object)
 * into standard DD/MM/YYYY (e.g. 19/11/2026).
 * Immune to off-by-one timezone shifts.
 */
export function formatDateDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';

  // 1. Direct YYYY-MM-DD string: Split without timezone conversion to prevent off-by-one shifts
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch && !trimmed.includes('T')) {
      const [, year, month, day] = ymdMatch;
      return `${day}/${month}/${year}`;
    }
  }

  // 2. Date object or ISO timestamp string: Format in Asia/Kolkata (IST) / Indian locale
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(d);

    const day = parts.find((p) => p.type === 'day')?.value || '';
    const month = parts.find((p) => p.type === 'month')?.value || '';
    const year = parts.find((p) => p.type === 'year')?.value || '';

    if (day && month && year) {
      return `${day}/${month}/${year}`;
    }

    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return String(dateInput);
  }
}
export function parseCurrencyToNumber(value: unknown): number {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  if (value === null || value === undefined) return 0;

  // Convert to string and clean out currency symbols, commas, and whitespace
  const cleaned = String(value)
    .replace(/[₹$,\s]/g, '')
    .replace(/^[^\d.-]+/, '') // remove leading symbols or words like 'Rs.'
    .replace(/[^\d.-]/g, ''); // strip any remaining unexpected characters

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Strips internal tracking references like [Debt:uuid] from descriptions for clean user display.
 */
export function formatDescription(desc: string | null | undefined): string {
  if (!desc) return '';
  return desc.replace(/\s*\[Debt:[^\]]+\]/gi, '').trim();
}


