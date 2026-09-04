import { activeGeocodingProvider } from './geocoding-provider';

const addresses = new Map<string, Promise<string>>();

export function needsMeetingPointAddress(address: string): boolean {
  return !address.trim() || /^(minha|sua) localização atual$/i.test(address.trim());
}

/** Share lookups across GPS refreshes and StrictMode mounts; never invent an address. */
export function resolveMeetingPointAddress(latitude: number, longitude: number): Promise<string> {
  const key = `${latitude},${longitude}`;
  const cached = addresses.get(key);
  if (cached) return cached;
  const lookup = activeGeocodingProvider.reverseGeocode(latitude, longitude).then(result => {
    if (result.source === 'DEVELOPMENT' || needsMeetingPointAddress(result.formattedAddress)) throw new Error('ADDRESS_NOT_FOUND');
    return result.formattedAddress;
  }).catch(error => { addresses.delete(key); throw error; });
  if (addresses.size >= 32) addresses.delete(addresses.keys().next().value!);
  addresses.set(key, lookup);
  return lookup;
}
