import { normalizePostalCode } from './awesomeapi-cep';
import type { LocationSuggestion } from './geocoding-provider';
import type { ProviderAddress } from '../../types';

export interface ProviderAddressFormValue {
  addressLine1: string;
  houseNumber: string;
  complement: string;
  postalCode: string;
  neighborhood: string;
  city: string;
  state: string;
  address?: ProviderAddress;
  locationMode?: 'STANDARD_ADDRESS' | 'NO_HOUSE_NUMBER' | 'MAP_PIN';
  approximateLatitude?: number;
  approximateLongitude?: number;
}

export interface ProviderAddressPayload {
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  address: Record<string, unknown> | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Copies one confirmed geocoding result into the provider form.
 * The selected result is authoritative, including its house number; an
 * older value must never survive a new address selection.
 */
export function applyProviderAddressSuggestion(value: ProviderAddressFormValue, suggestion: LocationSuggestion): ProviderAddressFormValue {
  const postalCode = normalizePostalCode(suggestion.postalCode || value.postalCode);
  const houseNumber = suggestion.houseNumber?.trim() || '';
  const addressLine1 = suggestion.street || suggestion.addressLine1 || suggestion.formattedAddress;

  return {
    ...value,
    locationMode: houseNumber ? 'STANDARD_ADDRESS' : value.locationMode || 'STANDARD_ADDRESS',
    addressLine1,
    houseNumber,
    neighborhood: suggestion.neighborhood || value.neighborhood,
    city: suggestion.city || value.city,
    state: suggestion.stateCode || suggestion.state || value.state,
    postalCode,
    address: {
      formatted: suggestion.formattedAddress,
      addressLine1: suggestion.addressLine1,
      addressLine2: suggestion.addressLine2,
      street: suggestion.street,
      houseNumber,
      neighborhood: suggestion.neighborhood,
      city: suggestion.city,
      state: suggestion.state,
      stateCode: suggestion.stateCode,
      postalCode,
      country: suggestion.country,
      countryCode: suggestion.countryCode,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      placeId: suggestion.placeId,
      source: 'GEOAPIFY',
    },
  };
}

export function isArtificialHouseNumber(value: string): boolean {
  return /^(?:NA|N\/A|SN|S\/N|SEM\s+N[UÚ]MERO)$/i.test(value.trim().replace(/[.-]/g, ' '));
}

export function validateProviderAddressForm(value: ProviderAddressFormValue): { valid: boolean; reason?: string; mode: NonNullable<ProviderAddressFormValue['locationMode']> } {
  const mode = value.locationMode || 'STANDARD_ADDRESS';
  const hasCoordinates = Number.isFinite(value.address?.latitude) && Number.isFinite(value.address?.longitude);
  if (mode === 'MAP_PIN') return { valid: Boolean(value.address?.locationConfirmed && hasCoordinates), reason: 'Confirme a localização no mapa.', mode };
  if (!value.addressLine1.trim() || !value.city.trim() || !value.state.trim()) return { valid: false, reason: 'Preencha o logradouro, cidade e UF.', mode };
  if (mode === 'NO_HOUSE_NUMBER') return { valid: Boolean(value.address?.locationConfirmed && hasCoordinates && !value.houseNumber.trim()), reason: 'Informe um CEP ou logradouro válido.', mode };
  return { valid: Boolean(value.houseNumber.trim() && !isArtificialHouseNumber(value.houseNumber) && value.address?.source === 'GEOAPIFY' && hasCoordinates), reason: 'Use um número real ou marque “Sem número”.', mode };
}

export function buildProviderAddressPayload(value: ProviderAddressFormValue): ProviderAddressPayload {
  const mode = value.locationMode || 'STANDARD_ADDRESS';
  const latitude = value.address?.latitude ?? null;
  const longitude = value.address?.longitude ?? null;
  const address: Record<string, unknown> | null = value.address
    ? {
      ...value.address,
      postalCode: normalizePostalCode(String(value.address.postalCode || value.postalCode)),
      complement: value.complement.trim() || undefined,
    }
    : null;
  if (address && mode !== 'STANDARD_ADDRESS') {
    delete address.houseNumber;
  }

  return {
    neighborhood: value.neighborhood.trim(),
    city: value.city.trim(),
    state: value.state.trim().toUpperCase(),
    postalCode: normalizePostalCode(value.postalCode),
    address,
    latitude,
    longitude,
  };
}
