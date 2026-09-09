const EMAIL_TIME_ZONE = 'America/Sao_Paulo';

function asDate(value: string | number | Date): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('EMAIL_INVALID_DATE');
  return date;
}

function assertCents(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('EMAIL_INVALID_CENTS');
}

export function formatCurrencyBRL(cents: number): string {
  assertCents(cents);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cents / 100)
    .replace(/\u00a0/g, ' ');
}

export function formatDatePtBR(value: string | number | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: EMAIL_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(asDate(value));
}

export function formatTimePtBR(value: string | number | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: EMAIL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(asDate(value));
}

export { EMAIL_TIME_ZONE };
