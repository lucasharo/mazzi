export type MeetingPointValue =
  | string
  | { name?: unknown; label?: unknown; address?: unknown }
  | null
  | undefined;

/** Converts persisted meeting-point DTOs into safe user-facing text. */
export function formatMeetingPoint(value: MeetingPointValue): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';

  for (const key of ['label', 'address', 'name'] as const) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  return '';
}
