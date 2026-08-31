export type MeetingPointValue =
  | string
  | { name?: unknown; label?: unknown; address?: unknown; fullAddress?: unknown; full_address?: unknown }
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

/** Returns the participant-visible full address when the booking contains one. */
export function formatFullMeetingPoint(value: MeetingPointValue): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';

  for (const key of ['full_address', 'fullAddress', 'address', 'label', 'name'] as const) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  return '';
}
