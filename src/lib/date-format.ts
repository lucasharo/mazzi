const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

function parseDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isBrazilianDate(value: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}

export function formatDateBR(value: string | Date): string {
  if (typeof value === 'string' && isBrazilianDate(value)) {
    return value;
  }
  if (typeof value === 'string' && isDateOnly(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseDate(value));
}

export function formatTimeBR(value: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parseDate(value));
}

export function formatDateTimeBR(value: string | Date): string {
  return `${formatDateBR(value)} ${formatTimeBR(value)}`;
}

export function formatDateRangeBR(start: string | Date, end: string | Date): string {
  return `${formatDateTimeBR(start)} - ${formatTimeBR(end)}`;
}

/** Returns a YYYY-MM-DD business date in the app timezone, safely across UTC offsets. */
export function getBusinessDateOnly(offsetDays = 0, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return date.toISOString().slice(0, 10);
}

export { BRAZIL_TIME_ZONE };
