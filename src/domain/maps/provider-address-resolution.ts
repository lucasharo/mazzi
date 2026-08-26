import { activeGeocodingProvider, LocationSuggestion, StructuredGeocodingAddress } from './geocoding-provider';
import { normalizePostalCode } from './awesomeapi-cep';
import { ProviderAddress } from '../../types';

function normalize(value: string | undefined): string {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(av|avenida|r|rua)\.?\s+/g, '').replace(/\s+/g, ' ').trim();
}

function candidateMatches(candidate: LocationSuggestion, input: StructuredGeocodingAddress): boolean {
  const candidateStreet = normalize(candidate.street || candidate.addressLine1);
  const street = normalize(input.street);
  return (candidateStreet.includes(street) || street.includes(candidateStreet))
    && (input.houseNumber ? normalize(candidate.houseNumber) === normalize(input.houseNumber) : true)
    && (!candidate.postalCode || normalizePostalCode(candidate.postalCode) === normalizePostalCode(input.postalCode))
    && (!candidate.city || normalize(candidate.city) === normalize(input.city))
    && (!candidate.stateCode || normalize(candidate.stateCode) === normalize(input.stateCode));
}

export async function resolveProviderAddress(input: StructuredGeocodingAddress, provider = activeGeocodingProvider): Promise<ProviderAddress> {
  if (!provider.geocodeStructuredAddress) throw new Error('GEOAPIFY_API_KEY_MISSING');
  const candidates = await provider.geocodeStructuredAddress(input);
  const exact = input.houseNumber
    ? candidates.find((candidate) => candidateMatches(candidate, input) && ['building', 'amenity'].includes(candidate.resultType || ''))
      || candidates.find((candidate) => candidateMatches(candidate, input))
    : candidates.find((candidate) => candidateMatches(candidate, input));
  if (!exact) throw new Error('ADDRESS_NOT_CONFIRMED');
  return {
    formatted: exact.formattedAddress,
    addressLine1: exact.addressLine1,
    addressLine2: exact.addressLine2,
    street: exact.street || input.street,
    houseNumber: exact.houseNumber || input.houseNumber || undefined,
    neighborhood: exact.neighborhood,
    city: exact.city || input.city,
    state: exact.state,
    stateCode: exact.stateCode || input.stateCode,
    postalCode: exact.postalCode || input.postalCode,
    country: exact.country,
    countryCode: exact.countryCode || input.countryCode || 'br',
    latitude: exact.latitude,
    longitude: exact.longitude,
    placeId: exact.placeId,
    source: 'GEOAPIFY',
    locationMode: input.houseNumber ? 'STANDARD_ADDRESS' : 'NO_HOUSE_NUMBER',
    noHouseNumber: !input.houseNumber,
    locationConfirmed: true,
    confirmationMethod: 'GEOAPIFY',
  };
}

export function isProviderAddressConfirmed(address?: ProviderAddress): boolean {
  if (!address || !Number.isFinite(address.latitude) || !Number.isFinite(address.longitude)) return false;
  if (address.locationMode === 'MAP_PIN') return address.locationConfirmed === true && address.confirmationMethod === 'MAP_PIN';
  if (address.locationMode === 'NO_HOUSE_NUMBER') return address.locationConfirmed === true && (address.confirmationMethod === 'GEOAPIFY' || address.confirmationMethod === 'MAP_PIN');
  return address.locationConfirmed === true || address.source === 'GEOAPIFY';
}
