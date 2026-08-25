import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeoapifyGeocodingProvider } from '../src/domain/maps/geocoding-provider';

afterEach(() => vi.restoreAllMocks());

describe('Geoapify location adapter', () => {
  it('requests Brazilian autocomplete with Portuguese language and lng,lat proximity', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ results: [{ properties: {
      formatted: 'Avenida Paulista, 1000, São Paulo - SP', address_line1: 'Avenida Paulista, 1000', address_line2: 'Bela Vista, São Paulo - SP', street: 'Avenida Paulista', housenumber: '1000', suburb: 'Bela Vista', city: 'São Paulo', state: 'São Paulo', state_code: 'SP', postcode: '01310-100', country_code: 'br', lat: -23.56, lon: -46.65, place_id: 'place-1', result_type: 'building',
    } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const [result] = await new GeoapifyGeocodingProvider('test-key').autocomplete('Av Paulista', { proximity: { longitude: -46.65, latitude: -23.56 }, limit: 6 });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/v1/geocode/autocomplete');
    expect(url.searchParams.get('filter')).toBe('countrycode:br');
    expect(url.searchParams.get('lang')).toBe('pt');
    expect(url.searchParams.get('limit')).toBe('6');
    expect(url.searchParams.get('bias')).toBe('proximity:-46.65,-23.56');
    expect(url.searchParams.get('apiKey')).toBe('test-key');
    expect(result).toMatchObject({ formattedAddress: 'Avenida Paulista, 1000, São Paulo - SP', latitude: -23.56, longitude: -46.65, postalCode: '01310-100', source: 'GEOAPIFY' });
  });

  it('maps reverse geocoding and reports rate limits without exposing raw response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 429 }));
    await expect(new GeoapifyGeocodingProvider('test-key').reverseGeocode(-23.56, -46.65)).rejects.toThrow('GEOAPIFY_RATE_LIMIT');
  });

  it('requires a configured key instead of silently calling a public geocoder', async () => {
    await expect(new GeoapifyGeocodingProvider('').geocode('Avenida Paulista')).rejects.toThrow('GEOAPIFY_API_KEY_MISSING');
  });
});
