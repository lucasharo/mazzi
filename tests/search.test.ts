// ============================================================================
// MAZZI PLATFORM — SPRINT 07 SEARCH & MAPS ENGINE UNIT TEST SUITE
// Automated verification of search pipeline, PostGIS spatial radius filters,
// DTO sanitization, location privacy protection, CFC resource candidate aggregation,
// configurable ranking, and geocoding/tile abstractions.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  validateSearchRequest,
  calculateHaversineDistanceMeters,
  formatPublicDistance,
  sanitizePublicSearchProviderResult,
  computeRankingScore,
  executePublicSearch,
  MAX_SEARCH_RADIUS_METERS,
  DEFAULT_SEARCH_RANKING_CONFIG,
  getPublicMapLocation,
} from '../src/domain/search';
import {
  Provider,
  Vehicle,
  ServiceOffering,
  SearchRequest,
  AvailabilityRule,
  Booking,
} from '../src/types';
import {
  DevelopmentGeocodingAdapter,
  activeGeocodingProvider,
} from '../src/domain/maps/geocoding-provider';
import {
  getActiveMapTileProvider,
  OSM_MAP_TILE_PROVIDER,
  CARTO_POSITRON_TILE_PROVIDER,
} from '../src/domain/maps/map-tile-provider';

// Test Mock Fixtures
const MOCK_ACTIVE_PROVIDER_1: Provider = {
  id: 'prov_active_1',
  name: 'Carlos Alberto Silva',
  type: 'INSTRUCTOR',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
  documentNumber: '123.456.789-00',
  status: 'ACTIVE',
  phone: '(11) 98765-4321',
  city: 'São Paulo',
  state: 'SP',
  neighborhood: 'Pinheiros',
  latitude: -23.5658,
  longitude: -46.6872,
  categories: ['B'],
  transmissions: ['MANUAL'],
  ratingAverage: 4.9,
  ratingCount: 42,
  startingPriceInCents: 9500,
  isVerified: true,
  bio: 'Instrutor credenciado com 10 anos de experiência.',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_ACTIVE_PROVIDER_CFC: Provider = {
  id: 'prov_active_cfc',
  name: 'Autoescola Grand Prix (CFC)',
  type: 'DRIVING_SCHOOL',
  avatarUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623',
  documentNumber: '12.345.678/0001-99',
  status: 'ACTIVE',
  phone: '(11) 3000-0000',
  city: 'São Paulo',
  state: 'SP',
  neighborhood: 'Bela Vista',
  latitude: -23.5587,
  longitude: -46.6483,
  categories: ['A', 'B'],
  transmissions: ['MANUAL', 'AUTOMATIC'],
  ratingAverage: 4.7,
  ratingCount: 120,
  startingPriceInCents: 11000,
  isVerified: true,
  bio: 'CFC Tradicional de São Paulo.',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_INACTIVE_PROVIDER: Provider = {
  ...MOCK_ACTIVE_PROVIDER_1,
  id: 'prov_inactive',
  name: 'Instrutor Bloqueado',
  status: 'SUSPENDED',
};

const MOCK_VEHICLE_1: Vehicle = {
  id: 'veh_1',
  providerId: 'prov_active_1',
  brand: 'Hyundai',
  model: 'HB20',
  year: 2024,
  licensePlate: 'ABC-1234',
  vehicleType: 'CAR',
  category: 'B',
  transmission: 'MANUAL',
  status: 'ACTIVE',
  photos: ['https://example.com/hb20.jpg'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_VEHICLE_CFC_1: Vehicle = {
  id: 'veh_cfc_1',
  providerId: 'prov_active_cfc',
  brand: 'Toyota',
  model: 'Yaris',
  year: 2024,
  licensePlate: 'CFC-9999',
  vehicleType: 'CAR',
  category: 'B',
  transmission: 'AUTOMATIC',
  status: 'ACTIVE',
  photos: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_OFFERING_1: ServiceOffering = {
  id: 'offering_1',
  providerId: 'prov_active_1',
  vehicleId: 'veh_1',
  category: 'B',
  durationMinutes: 50,
  priceInCents: 9500,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_OFFERING_CFC_1: ServiceOffering = {
  id: 'offering_cfc_1',
  providerId: 'prov_active_cfc',
  vehicleId: 'veh_cfc_1',
  category: 'B',
  durationMinutes: 50,
  priceInCents: 11000,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_RULE_1: AvailabilityRule = {
  id: 'rule_1',
  providerId: 'prov_active_1',
  dayOfWeek: 'MONDAY',
  startTime: '08:00',
  endTime: '18:00',
  instructorId: 'prov_active_1',
  vehicleId: 'veh_1',
  timezone: 'America/Sao_Paulo',
  isActive: true,
  effectiveFrom: '2026-01-01',
};

const MOCK_RULE_CFC_1: AvailabilityRule = {
  id: 'rule_cfc_1',
  providerId: 'prov_active_cfc',
  dayOfWeek: 'MONDAY',
  startTime: '08:00',
  endTime: '18:00',
  instructorId: 'inst_cfc_a',
  vehicleId: 'veh_cfc_1',
  timezone: 'America/Sao_Paulo',
  isActive: true,
  effectiveFrom: '2026-01-01',
};

describe('Sprint 07 — Search Request Validation', () => {
  it('validates a correct search request with default parameters', () => {
    const req: SearchRequest = {
      latitude: -23.5658,
      longitude: -46.6872,
    };
    const res = validateSearchRequest(req);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.sanitized.radiusMeters).toBe(10000);
    expect(res.sanitized.page).toBe(1);
    expect(res.sanitized.limit).toBe(10);
  });

  it('rejects invalid latitude or longitude coordinates', () => {
    const res1 = validateSearchRequest({ latitude: 100, longitude: -46.6872 });
    expect(res1.isValid).toBe(false);
    expect(res1.errors[0]).toContain('Latitude must be a valid number');

    const res2 = validateSearchRequest({ latitude: -23.5658, longitude: -200 });
    expect(res2.isValid).toBe(false);
    expect(res2.errors[0]).toContain('Longitude must be a valid number');
  });

  it('rejects search radius exceeding maximum limit (50,000 meters)', () => {
    const res = validateSearchRequest({ radiusMeters: 60000 });
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('radiusMeters must be between 1 and 50000');
  });

  it('rejects invalid category (only A or B allowed in MVP)', () => {
    const res = validateSearchRequest({ category: 'C' as any });
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('Category must be either "A" or "B"');
  });

  it('rejects maxPriceInCents smaller than minPriceInCents', () => {
    const res = validateSearchRequest({ minPriceInCents: 10000, maxPriceInCents: 5000 });
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('maxPriceInCents cannot be smaller than minPriceInCents');
  });
});

describe('Sprint 07 — Location Privacy Gate (Hardening Audit)', () => {
  it('calculates Haversine distance accurately for internal ranking', () => {
    // Pinheiros (-23.5658, -46.6872) to Bela Vista (-23.5587, -46.6483) ~ 4.0km
    const distMeters = calculateHaversineDistanceMeters(-23.5658, -46.6872, -23.5587, -46.6483);
    expect(distMeters).toBeGreaterThan(3800);
    expect(distMeters).toBeLessThan(4200);
  });

  it('A & B: Search DTO does not contain exactDistanceMeters or privateLocation, returns roundedDistanceMeters and formattedDistance', () => {
    const publicResult = sanitizePublicSearchProviderResult(
      MOCK_ACTIVE_PROVIDER_1,
      [],
      1834.726, // Exact geodesic float
      5,
      1,
      undefined,
      0.85
    );

    // Verify exact private fields are strictly absent
    expect(publicResult).not.toHaveProperty('exactDistanceMeters');
    expect(publicResult).not.toHaveProperty('privateLocation');
    expect(publicResult).not.toHaveProperty('latitude');
    expect(publicResult).not.toHaveProperty('longitude');
    expect(publicResult).not.toHaveProperty('documentNumber');
    expect(publicResult).not.toHaveProperty('phone');
    expect(publicResult).not.toHaveProperty('email');
    expect(publicResult).not.toHaveProperty('licensePlate');
    expect(publicResult).not.toHaveProperty('cpf');
    expect(publicResult).not.toHaveProperty('cnpj');
    expect(publicResult).not.toHaveProperty('bankAccount');

    // Verify sanitized rounded distance
    expect(publicResult.roundedDistanceMeters).toBe(1800);
    expect(publicResult.approximateDistanceKm).toBe(1.8);
    expect(publicResult.formattedDistance).toBe('1,8 km');
    expect(publicResult.displayName).toBe('Carlos Alberto Silva');
    expect(publicResult.verificationBadge).toBe('Verificado pela plataforma');
  });

  it('C: Public Provider Profile DTO contains zero private location coordinates', () => {
    const publicResult = sanitizePublicSearchProviderResult(
      MOCK_ACTIVE_PROVIDER_1,
      [],
      1200,
      3,
      1,
      undefined,
      0.9
    );

    expect((publicResult as any).latitude).toBeUndefined();
    expect((publicResult as any).longitude).toBeUndefined();
    expect((publicResult as any).address).toBeUndefined();
    expect(publicResult.neighborhood).toBe('Pinheiros');
    expect(publicResult.city).toBe('São Paulo');
  });

  it('D: Provider with recognized neighborhood centroid returns NEIGHBORHOOD_CENTROID map location', () => {
    const pubLoc = getPublicMapLocation(MOCK_ACTIVE_PROVIDER_1); // neighborhood: Pinheiros
    expect(pubLoc.type).toBe('NEIGHBORHOOD_CENTROID');
    expect(pubLoc.label).toBe('Pinheiros, São Paulo');
    expect(pubLoc.latitude).toBe(-23.5658);
    expect(pubLoc.longitude).toBe(-46.6872);
  });

  it('E: Provider with explicit public meeting point returns MEETING_POINT map location', () => {
    const providerWithMeetingPoint: Provider = {
      ...MOCK_ACTIVE_PROVIDER_1,
      meetingPointLatitude: -23.5612,
      meetingPointLongitude: -46.6855,
      meetingPointName: 'Estação Fradique Coutinho Metrô',
    };

    const pubLoc = getPublicMapLocation(providerWithMeetingPoint);
    expect(pubLoc.type).toBe('MEETING_POINT');
    expect(pubLoc.latitude).toBe(-23.5612);
    expect(pubLoc.longitude).toBe(-46.6855);
    expect(pubLoc.label).toBe('Estação Fradique Coutinho Metrô');
  });

  it('F: Provider with service area center returns SERVICE_AREA map location', () => {
    const providerWithServiceArea: Provider = {
      ...MOCK_ACTIVE_PROVIDER_1,
      meetingPointLatitude: undefined,
      meetingPointLongitude: undefined,
      neighborhood: '', // No neighborhood centroid match
      serviceAreaCenterLatitude: -23.5700,
      serviceAreaCenterLongitude: -46.6500,
    };

    const pubLoc = getPublicMapLocation(providerWithServiceArea);
    expect(pubLoc.type).toBe('SERVICE_AREA');
    expect(pubLoc.latitude).toBe(-23.5700);
    expect(pubLoc.longitude).toBe(-46.6500);
    expect(pubLoc.label).toContain('Área de Atendimento');
  });

  it('G: Provider without safe public location fallback NEVER exposes privateLocation (returns REGIONAL_CENTROID or UNAVAILABLE)', () => {
    const providerNoPublicLocation: Provider = {
      ...MOCK_ACTIVE_PROVIDER_1,
      latitude: -23.999999, // Private residential coordinate
      longitude: -46.888888,
      neighborhood: 'Bairro Desconhecido Sem Centroide',
      city: 'Curitiba',
      meetingPointLatitude: undefined,
      meetingPointLongitude: undefined,
      serviceAreaCenterLatitude: undefined,
      serviceAreaCenterLongitude: undefined,
    };

    const pubLoc = getPublicMapLocation(providerNoPublicLocation);
    // Must NOT reveal raw residential coordinates
    expect(pubLoc.latitude).not.toBe(-23.999999);
    expect(pubLoc.longitude).not.toBe(-46.888888);
    expect(pubLoc.type).toBe('UNAVAILABLE');
    expect(pubLoc.label).toBe('Bairro Desconhecido Sem Centroide, Curitiba');
  });

  it('H: Triangulation Resistance: Repeated Search requests receive roundedDistanceMeters (100m steps) instead of exact geodesic floats', () => {
    // Simulate multiple searches from slightly shifted user coordinates
    const distance1 = 1834.726;
    const distance2 = 1848.112;
    const distance3 = 1812.990;

    const res1 = formatPublicDistance(distance1);
    const res2 = formatPublicDistance(distance2);
    const res3 = formatPublicDistance(distance3);

    // All distances in the 1800-1849m window round to 1800m / 1,8 km
    expect(res1.roundedDistanceMeters).toBe(1800);
    expect(res2.roundedDistanceMeters).toBe(1800);
    expect(res3.roundedDistanceMeters).toBe(1800);
    expect(res1.formattedDistance).toBe('1,8 km');
    expect(res2.formattedDistance).toBe('1,8 km');
    expect(res3.formattedDistance).toBe('1,8 km');
  });
});

describe('Sprint 07 — Search Pipeline Execution', () => {
  it('filters out inactive or suspended providers', () => {
    const response = executePublicSearch({
      providers: [MOCK_ACTIVE_PROVIDER_1, MOCK_INACTIVE_PROVIDER],
      vehicles: [MOCK_VEHICLE_1],
      offerings: [MOCK_OFFERING_1],
      availabilityRules: [MOCK_RULE_1],
      exceptions: [],
      existingBookings: [],
      searchRequest: { latitude: -23.5658, longitude: -46.6872, date: '2026-08-17' }, // Monday
      referenceTime: new Date('2026-08-01T10:00:00Z'),
    });

    expect(response.totalCount).toBe(1);
    expect(response.results[0].providerId).toBe('prov_active_1');
  });

  it('filters providers by spatial radius boundary (1km included in 5km, 7km excluded)', () => {
    // Provider 1 in Pinheiros (~0m away), Provider 2 in Bela Vista (~4.1km away)
    const response5k = executePublicSearch({
      providers: [MOCK_ACTIVE_PROVIDER_1, MOCK_ACTIVE_PROVIDER_CFC],
      vehicles: [MOCK_VEHICLE_1, MOCK_VEHICLE_CFC_1],
      offerings: [MOCK_OFFERING_1, MOCK_OFFERING_CFC_1],
      availabilityRules: [MOCK_RULE_1, MOCK_RULE_CFC_1],
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: -23.5658,
        longitude: -46.6872,
        radiusMeters: 5000, // 5km radius includes both
        date: '2026-08-17',
      },
      referenceTime: new Date('2026-08-01T10:00:00Z'),
    });

    expect(response5k.results).toHaveLength(2);

    const response2k = executePublicSearch({
      providers: [MOCK_ACTIVE_PROVIDER_1, MOCK_ACTIVE_PROVIDER_CFC],
      vehicles: [MOCK_VEHICLE_1, MOCK_VEHICLE_CFC_1],
      offerings: [MOCK_OFFERING_1, MOCK_OFFERING_CFC_1],
      availabilityRules: [MOCK_RULE_1, MOCK_RULE_CFC_1],
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: -23.5658,
        longitude: -46.6872,
        radiusMeters: 2000, // 2km radius includes only Pinheiros provider
        date: '2026-08-17',
      },
      referenceTime: new Date('2026-08-01T10:00:00Z'),
    });

    expect(response2k.results).toHaveLength(1);
    expect(response2k.results[0].providerId).toBe('prov_active_1');
  });

  it('filters by category B vs category A', () => {
    const responseB = executePublicSearch({
      providers: [MOCK_ACTIVE_PROVIDER_1],
      vehicles: [MOCK_VEHICLE_1],
      offerings: [MOCK_OFFERING_1],
      availabilityRules: [MOCK_RULE_1],
      exceptions: [],
      existingBookings: [],
      searchRequest: { category: 'A', date: '2026-08-17' },
      referenceTime: new Date('2026-08-01T10:00:00Z'),
    });

    // MOCK_OFFERING_1 is Category B, so Category A search must return empty
    expect(responseB.results).toHaveLength(0);
  });

  it('filters by transmission type AUTOMATIC', () => {
    const responseAuto = executePublicSearch({
      providers: [MOCK_ACTIVE_PROVIDER_1, MOCK_ACTIVE_PROVIDER_CFC],
      vehicles: [MOCK_VEHICLE_1, MOCK_VEHICLE_CFC_1],
      offerings: [MOCK_OFFERING_1, MOCK_OFFERING_CFC_1],
      availabilityRules: [MOCK_RULE_1, MOCK_RULE_CFC_1],
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: -23.5658,
        longitude: -46.6872,
        category: 'B',
        transmission: 'AUTOMATIC',
        radiusMeters: 10000,
        date: '2026-08-17',
      },
      referenceTime: new Date('2026-08-01T10:00:00Z'),
    });

    expect(responseAuto.results).toHaveLength(1);
    expect(responseAuto.results[0].providerId).toBe('prov_active_cfc');
  });

  it('applies configurable ranking score and sorts deterministically', () => {
    const score = computeRankingScore(1000, 4.9, 9500, 10, 5000, DEFAULT_SEARCH_RANKING_CONFIG);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1.0);
  });
});

describe('Sprint 07 — Geocoding & Tile Abstractions', () => {
  it('DevelopmentGeocodingAdapter resolves known SP neighborhood queries', async () => {
    const adapter = new DevelopmentGeocodingAdapter();
    const res = await adapter.geocode('Pinheiros, SP');
    expect(res).toHaveLength(1);
    expect(res[0].neighborhood).toBe('Pinheiros');
    expect(res[0].latitude).toBe(-23.5658);
  });

  it('getActiveMapTileProvider returns OpenStreetMap standard tile config by default', () => {
    const tile = getActiveMapTileProvider();
    expect(tile.id).toBe('openstreetmap');
    expect(tile.urlTemplate).toContain('{z}/{x}/{y}.png');
  });
});
