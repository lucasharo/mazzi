import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AwesomeApiCepProvider, maskPostalCode, normalizePostalCode } from '../src/domain/maps/awesomeapi-cep';
import { GeoapifyGeocodingProvider } from '../src/domain/maps/geocoding-provider';
import { isProviderAddressConfirmed, resolveProviderAddress } from '../src/domain/maps/provider-address-resolution';
import { buildProviderAddressPayload, validateProviderAddressForm } from '../src/domain/maps/provider-address-payload';

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

  it('maps the flat structured-search result returned by Geoapify and confirms the CEP', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ results: [{
      country_code: 'br', housenumber: '143', street: 'Rua Icaveta', country: 'Brasil', postcode: '04459-300', state: 'Sudeste', district: 'Jardim Paulista', city: 'São Paulo', suburb: 'Pedreira', county_code: 'SP', lon: -46.672569, lat: -23.695757, result_type: 'building', formatted: 'Rua Icaveta 143, Pedreira, São Paulo - Sudeste, 04459-300, Brasil', address_line1: 'Rua Icaveta 143', address_line2: 'Pedreira, São Paulo - Sudeste, 04459-300, Brasil', place_id: 'place-1',
    }] }), { status: 200 }));
    const provider = new GeoapifyGeocodingProvider('test-key');
    const result = await resolveProviderAddress({ street: 'Rua Icavetá', houseNumber: '143', postalCode: '04459300', city: 'São Paulo', stateCode: 'SP', countryCode: 'br' }, provider);
    expect(result).toMatchObject({ street: 'Rua Icaveta', houseNumber: '143', postalCode: '04459-300', city: 'São Paulo', stateCode: 'SP', source: 'GEOAPIFY' });
  });

  it('omits housenumber for a no-house-number street lookup', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ results: [{ formatted: 'Rua Icaveta, Pedreira, São Paulo', address_line1: 'Rua Icaveta', street: 'Rua Icaveta', postcode: '04459-300', suburb: 'Pedreira', city: 'São Paulo', state_code: 'SP', country_code: 'br', lat: -23.6959, lon: -46.6723, result_type: 'street' }] }), { status: 200 }));
    const provider = new GeoapifyGeocodingProvider('test-key');
    const result = await resolveProviderAddress({ street: 'Rua Icavetá', houseNumber: null, postalCode: '04459300', city: 'São Paulo', stateCode: 'SP', countryCode: 'br' }, provider);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.has('housenumber')).toBe(false);
    expect(result).toMatchObject({ locationMode: 'NO_HOUSE_NUMBER', noHouseNumber: true, locationConfirmed: true, confirmationMethod: 'GEOAPIFY', latitude: -23.6959 });
    expect(isProviderAddressConfirmed(result)).toBe(true);
    expect(validateProviderAddressForm({ addressLine1: 'Rua Icavetá', houseNumber: '', complement: '', postalCode: '04459-300', neighborhood: 'Pedreira', city: 'São Paulo', state: 'SP', locationMode: 'NO_HOUSE_NUMBER', address: result }).valid).toBe(true);
  });

  it('treats artificial house numbers as invalid and keeps map pins private in the payload', () => {
    const pin = { latitude: -23.6959, longitude: -46.6723, source: 'MAP_PIN' as const, locationMode: 'MAP_PIN' as const, locationConfirmed: true, confirmationMethod: 'MAP_PIN' as const, houseNumber: '143' };
    expect(validateProviderAddressForm({ addressLine1: '', houseNumber: 'NA', complement: 'Portão azul', postalCode: '', neighborhood: '', city: '', state: '', locationMode: 'MAP_PIN', address: pin }).valid).toBe(true);
    expect(validateProviderAddressForm({ addressLine1: 'Rua A', houseNumber: 'S/N', complement: '', postalCode: '00000000', neighborhood: 'Centro', city: 'São Paulo', state: 'SP', locationMode: 'STANDARD_ADDRESS', address: { source: 'GEOAPIFY', latitude: -23, longitude: -46 } }).valid).toBe(false);
    expect(isProviderAddressConfirmed(pin)).toBe(true);
    expect(buildProviderAddressPayload({ addressLine1: '', houseNumber: '143', complement: 'Portão azul', postalCode: '', neighborhood: '', city: '', state: '', locationMode: 'MAP_PIN', address: pin }).address).not.toHaveProperty('houseNumber');
  });
});
