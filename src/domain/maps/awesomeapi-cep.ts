export interface BrazilianPostalAddress {
  postalCode: string;
  street: string;
  neighborhood: string;
  city: string;
  stateCode: string;
  stateName?: string;
  cityIbge?: string;
  ddd?: string;
  approximateLatitude?: number;
  approximateLongitude?: number;
  source: 'AWESOMEAPI';
}

const cache = new Map<string, { expiresAt: number; value: BrazilianPostalAddress }>();

export function normalizePostalCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function maskPostalCode(value: string): string {
  const digits = normalizePostalCode(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export class AwesomeApiCepProvider {
  async lookupPostalCode(postalCode: string, signal?: AbortSignal): Promise<BrazilianPostalAddress> {
    const normalized = normalizePostalCode(postalCode);
    if (normalized.length !== 8) throw new Error('CEP_INVALID');
    const cached = cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const response = await fetch(`https://cep.awesomeapi.com.br/json/${normalized}`, { signal, headers: { Accept: 'application/json' } });
    if (response.status === 404) throw new Error('CEP_NOT_FOUND');
    if (!response.ok) throw new Error('CEP_UNAVAILABLE');
    const body = await response.json() as Record<string, unknown>;
    if (!body.address || !body.city || !body.state) throw new Error('CEP_NOT_FOUND');
    const value: BrazilianPostalAddress = {
      postalCode: normalizePostalCode(String(body.cep || normalized)),
      street: String(body.address || body.address_name || ''),
      neighborhood: String(body.district || ''),
      city: String(body.city),
      stateCode: String(body.state).toUpperCase(),
      cityIbge: body.city_ibge ? String(body.city_ibge) : undefined,
      ddd: body.ddd ? String(body.ddd) : undefined,
      approximateLatitude: Number.isFinite(Number(body.lat)) ? Number(body.lat) : undefined,
      approximateLongitude: Number.isFinite(Number(body.lng)) ? Number(body.lng) : undefined,
      source: 'AWESOMEAPI',
    };
    cache.set(normalized, { expiresAt: Date.now() + 24 * 60 * 60_000, value });
    return value;
  }
}

export const awesomeApiCepProvider = new AwesomeApiCepProvider();
