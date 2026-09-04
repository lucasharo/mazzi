import { needsMeetingPointAddress } from '../domain/maps/meeting-point-address';

export type MeetingPointValue =
  | string
  | { name?: unknown; label?: unknown; address?: unknown; formattedAddress?: unknown; formatted_address?: unknown; fullAddress?: unknown; full_address?: unknown; neighborhood?: unknown; city?: unknown }
  | null
  | undefined;

/** Converts persisted meeting-point DTOs into safe user-facing text. */
export function formatMeetingPoint(value: MeetingPointValue): string {
  if (typeof value === 'string') {
    return needsMeetingPointAddress(value) ? '' : value.trim();
  }
  if (!value || typeof value !== 'object') return '';

  for (const key of ['formattedAddress', 'formatted_address', 'full_address', 'fullAddress', 'address', 'street', 'neighborhood', 'district', 'city', 'label', 'name'] as const) {
    const candidate = (value as any)[key];
    if (typeof candidate === 'string' && candidate.trim() && !needsMeetingPointAddress(candidate)) {
      return candidate.trim();
    }
  }

  return '';
}

/** Returns the participant-visible full address when the booking contains one. */
export function formatFullMeetingPoint(value: MeetingPointValue): string {
  return formatMeetingPoint(value);
}

/**
 * Formats a privacy-protected meeting point summary for bookings awaiting payment.
 * Hides street names, house numbers, and exact coordinates until payment is confirmed.
 */
export function formatPendingPaymentMeetingPoint(value: MeetingPointValue): string {
  if (!value) return 'Região liberada após confirmação do pagamento';

  if (typeof value === 'object' && value !== null) {
    const neighborhood = (value as any).neighborhood || (value as any).suburb || (value as any).district;
    const city = (value as any).city || (value as any).town;
    if (typeof neighborhood === 'string' && neighborhood.trim() && typeof city === 'string' && city.trim()) {
      return `${neighborhood.trim()}, ${city.trim()}`;
    }
    if (typeof neighborhood === 'string' && neighborhood.trim()) {
      return `Bairro ${neighborhood.trim()}`;
    }
    if (typeof city === 'string' && city.trim()) {
      return `Região de ${city.trim()}`;
    }
  }

  const fullText = typeof value === 'string' ? value.trim() : formatMeetingPoint(value);
  if (!fullText) return 'Região liberada após confirmação do pagamento';

  const parts = fullText.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    const maskedParts = parts.filter((part) => {
      const isStreetOrNumber =
        /^(rua|av|avenida|alameda|praça|praca|travessa|rodovia|estrada|\d+)/i.test(part) ||
        /\d{5}-\d{3}/.test(part) ||
        /\d+/.test(part);
      const isCountry = /^(brasil|brazil)$/i.test(part);
      return !isStreetOrNumber && !isCountry;
    });

    if (maskedParts.length > 0) {
      return maskedParts.join(', ');
    }
  }

  return 'Região liberada após confirmação do pagamento';
}
