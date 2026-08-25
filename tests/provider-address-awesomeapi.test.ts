import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AwesomeApiCepProvider, maskPostalCode, normalizePostalCode } from '../src/domain/maps/awesomeapi-cep';
import { GeoapifyGeocodingProvider } from '../src/domain/maps/geocoding-provider';

describe('Brazilian provider address flow', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('normalizes CEP input and masks only the presentation', () => {
    expect(normalizePostalCode('01310-100')).toBe('01310100');
    expect(normalizePostalCode('01310a100')).toBe('01310100');
    expect(maskPostalCode('01310100')).toBe('01310-100');
    expect(maskPostalCode('01310-100')).toBe('01310-100');
  });

  it('performs exactly one lookup only after a valid eight-digit CEP', async () => {
    const provider = new AwesomeApiCepProvider();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ cep: '01001000', address: 'Praça da Sé', district: 'Sé', city: 'São Paulo', state: 'SP', city_ibge: '3550308', lat: '-23.5505', lng: '-46.6333' }), { status: 200 }));
    await expect(provider.lookupPostalCode('0100100')).rejects.toThrow('CEP_INVALID');
    expect(fetchMock).not.toHaveBeenCalled();
    const result = await provider.lookupPostalCode('01001000');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ postalCode: '01001000', street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', stateCode: 'SP', approximateLatitude: -23.5505, approximateLongitude: -46.6333, source: 'AWESOMEAPI' });
  });

  it('requests structured Geoapify fields and preserves longitude,latitude bias order', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ results: [{ properties: { formatted: 'Avenida Paulista, 1000, São Paulo, SP, Brasil', address_line1: 'Avenida Paulista 1000', street: 'Avenida Paulista', housenumber: '1000', postcode: '01310-100', city: 'São Paulo', state_code: 'SP', country_code: 'br', lat: -23.56, lon: -46.65, place_id: 'place-1', result_type: 'building' } }] }), { status: 200 }));
    const provider = new GeoapifyGeocodingProvider('test-key');
    const result = await provider.geocodeStructuredAddress!({ street: 'Avenida Paulista', houseNumber: '1000', postalCode: '01310100', city: 'São Paulo', stateCode: 'SP', proximity: { latitude: -23.55, longitude: -46.64 } });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/v1/geocode/search');
    expect(url.searchParams.get('street')).toBe('Avenida Paulista');
    expect(url.searchParams.get('housenumber')).toBe('1000');
    expect(url.searchParams.get('postcode')).toBe('01310100');
    expect(url.searchParams.get('filter')).toBe('countrycode:br');
    expect(url.searchParams.get('lang')).toBe('pt');
    expect(url.searchParams.get('bias')).toBe('proximity:-46.64,-23.55');
    expect(result[0]).toMatchObject({ houseNumber: '1000', latitude: -23.56, longitude: -46.65, resultType: 'building' });
  });
});
