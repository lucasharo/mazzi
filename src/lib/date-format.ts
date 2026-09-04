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

export function formatTimeRange(start?: string, end?: string): string {
  if (!start && !end) return 'Horário a confirmar';
  if (start && end) return `${start.substring(0, 5)} - ${end.substring(0, 5)}`;
  return (start || end || '').substring(0, 5);
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

/** Canonical helper: Returns YYYY-MM-DD date in America/Sao_Paulo timezone */
export function getTodayInSaoPaulo(now = new Date()): string {
  return getBusinessDateOnly(0, now);
}

/** Canonical helper: Converts any UTC ISO timestamp or Date into YYYY-MM-DD in America/Sao_Paulo timezone */
export function getBusinessDateFromTimestamp(timestamp: string | Date): string {
  const date = parseDate(timestamp);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/** Canonical helper: Returns HH:mm in America/Sao_Paulo timezone */
export function getTimeInSaoPaulo(timestamp: string | Date): string {
  const date = parseDate(timestamp);
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

/** Builds the canonical half-open range for a date-only block in São Paulo. */
export function buildFullDayBlockRange({
  startDate,
  inclusiveEndDate,
}: {
  startDate: string;
  inclusiveEndDate: string;
}): { startAt: string; endAt: string } {
  if (!isDateOnly(startDate) || !isDateOnly(inclusiveEndDate)) {
    throw new Error('Datas inválidas para bloqueio de dias.');
  }
  const start = new Date(`${startDate}T00:00:00-03:00`);
  const inclusiveEnd = new Date(`${inclusiveEndDate}T00:00:00-03:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(inclusiveEnd.getTime()) || inclusiveEnd < start) {
    throw new Error('O período do bloqueio de dias é inválido.');
  }
  const nextDay = new Date(Date.UTC(
    inclusiveEnd.getUTCFullYear(),
    inclusiveEnd.getUTCMonth(),
    inclusiveEnd.getUTCDate() + 1,
  ));
  return {
    startAt: `${startDate}T00:00:00.000-03:00`,
    endAt: `${nextDay.toISOString().slice(0, 10)}T00:00:00.000-03:00`,
  };
}

/** Converts a persisted date-only block into the user-facing inclusive range. */
export function getDayBlockDisplayRange(startAt: string | Date, endAt: string | Date): {
  startDate: string;
  endDate: string;
  label: 'Dia inteiro' | 'Dias inteiros';
} {
  const end = parseDate(endAt);
  const inclusiveEnd = new Date(end.getTime() - 1);
  const startDate = getBusinessDateFromTimestamp(startAt);
  const endDate = getBusinessDateFromTimestamp(inclusiveEnd);
  return {
    startDate: formatDateBR(startDate),
    endDate: formatDateBR(endDate),
    label: startDate === endDate ? 'Dia inteiro' : 'Dias inteiros',
  };
}

/** Canonical helper: Checks if a booking belongs to today in America/Sao_Paulo timezone */
export function isBookingTodayInSaoPaulo(
  booking: { scheduledDate?: string | null; scheduledStartAt?: string | null },
  now = new Date()
): boolean {
  const todayStr = getTodayInSaoPaulo(now);

  if (booking.scheduledStartAt) {
    const bookingDateInSp = getBusinessDateFromTimestamp(booking.scheduledStartAt);
    return bookingDateInSp === todayStr;
  }

  if (booking.scheduledDate) {
    return booking.scheduledDate === todayStr;
  }

  return false;
}

/**
 * Canonical helper: Resolves absolute epoch milliseconds for a booking timestamp.
 * Prefers ISO timestamp (scheduledEndAt / scheduledStartAt).
 * Fallback safely interprets scheduledDate + time in America/Sao_Paulo (-03:00), NEVER assuming UTC 'Z'.
 */
export function getCanonicalTimestamp(
  isoTimestamp?: string | null,
  dateOnly?: string | null,
  timeOnly?: string | null
): number | null {
  if (isoTimestamp) {
    const parsed = new Date(isoTimestamp).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  if (dateOnly && timeOnly) {
    // Construct local ISO string with explicit America/Sao_Paulo offset (-03:00)
    const timeFormatted = timeOnly.length === 5 ? `${timeOnly}:00` : timeOnly;
    const localIso = `${dateOnly}T${timeFormatted}-03:00`;
    const parsed = new Date(localIso).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

/** Canonical helper: Returns true if lesson end timestamp is in the past (scheduled_end_at <= NOW) */
export function isLessonEnded(
  booking: { scheduledEndAt?: string | null; scheduledDate?: string | null; endTime?: string | null },
  now = new Date()
): boolean {
  const endMs = getCanonicalTimestamp(booking.scheduledEndAt, booking.scheduledDate, booking.endTime);
  if (endMs === null) return false;
  return endMs <= now.getTime();
}

/** Canonical helper: Calculates dynamic duration in minutes without hardcoding */
export function calculateLessonDurationMinutes(
  booking: {
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    scheduledDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    lessonStartedAt?: string | null;
    lessonFinishedAt?: string | null;
    durationMinutes?: number | null;
    snapshot?: { durationMinutes?: number | null } | null;
  }
): number | null {
  const lessonStartMs = booking.lessonStartedAt ? new Date(booking.lessonStartedAt).getTime() : NaN;
  const lessonEndMs = booking.lessonFinishedAt ? new Date(booking.lessonFinishedAt).getTime() : NaN;
  if (Number.isFinite(lessonStartMs) && Number.isFinite(lessonEndMs) && lessonEndMs > lessonStartMs) {
    return Math.round((lessonEndMs - lessonStartMs) / 60000);
  }
  if (booking.durationMinutes && booking.durationMinutes > 0) {
    return booking.durationMinutes;
  }
  if (booking.snapshot?.durationMinutes && booking.snapshot.durationMinutes > 0) {
    return booking.snapshot.durationMinutes;
  }
  const startMs = getCanonicalTimestamp(booking.scheduledStartAt, booking.scheduledDate, booking.startTime);
  const endMs = getCanonicalTimestamp(booking.scheduledEndAt, booking.scheduledDate, booking.endTime);
  if (startMs !== null && endMs !== null && endMs > startMs) {
    return Math.round((endMs - startMs) / 60000);
  }
  return null;
}

/** Canonical helper: Formats transmission label safely handling NOT_APPLICABLE */
export function formatTransmissionLabel(transmission?: string | null): string {
  if (!transmission) return 'Não se aplica';
  const upper = transmission.toUpperCase();
  if (upper === 'MANUAL') return 'Manual';
  if (upper === 'AUTOMATIC') return 'Automática';
  if (upper === 'NOT_APPLICABLE') return 'Não se aplica';
  return 'Não se aplica';
}

export { BRAZIL_TIME_ZONE };
