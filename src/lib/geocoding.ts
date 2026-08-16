export interface GeocodedAddress {
  latitude: number;
  longitude: number;
  displayName: string;
}

/** Development geocoder backed by OpenStreetMap's public Nominatim endpoint. */
export async function geocodeAddress(address: string): Promise<GeocodedAddress> {
  const query = `${address}, São Paulo, SP, Brasil`;
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('GEOCODING_UNAVAILABLE');
  const results = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
  const first = results[0];
  if (!first) throw new Error('ADDRESS_NOT_FOUND');
  return { latitude: Number(first.lat), longitude: Number(first.lon), displayName: first.display_name };
}
