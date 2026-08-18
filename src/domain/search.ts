// ============================================================================
// MAZZI PLATFORM — SEARCH, GEO DISCOVERY & RANKING ENGINE (SPRINT 07)
// PostGIS spatial query contract, backend-authoritative search pipeline,
// eligibility filters, availability integration, CFC resource candidate aggregation,
// instructor residential location privacy, configurable ranking, and sanitized Public Search DTOs.
//
// ARCHITECTURAL SOURCE OF TRUTH NOTICE:
// In production deployment with PostgreSQL/PostGIS, the primary spatial filter
// source of truth is the PostGIS `ST_DWithin` query executed directly on the
// `location_geography` (GEOGRAPHY(Point,4326)) column indexed via GiST.
//
// The TypeScript `calculateHaversineDistanceMeters` function in this module is
// explicitly classified as:
// - UNIT_TEST_HELPER
// - DEVELOPMENT_FALLBACK
// - DISTANCE_REFERENCE_IMPLEMENTATION
// ============================================================================

import {
  Provider,
  Vehicle,
  ServiceOffering,
  AvailabilityRule,
  AvailabilityException,
  Booking,
  SearchRequest,
  PublicSearchProviderResult,
  PublicOfferingSummary,
  PublicMapLocation,
  SearchResultResponse,
  SearchRankingConfiguration,
  VehicleCategory,
  TransmissionType,
  ProviderType,
  AvailabilityCandidate,
} from '../types';
import {
  generateAvailableSlots,
  DEFAULT_DEVELOPMENT_CONFIGURATION,
  STUDENT_BOOKING_HORIZON_DAYS,
  AVAILABILITY_SEARCH_HORIZON_DAYS,
} from './availability';

export class SearchValidationError extends Error {
  constructor(public errors: string[]) {
    super(`Search Validation Error: ${errors.join('; ')}`);
    this.name = 'SearchValidationError';
  }
}

// Re-export Canonical Horizon Constants from availability domain
export { STUDENT_BOOKING_HORIZON_DAYS, AVAILABILITY_SEARCH_HORIZON_DAYS };

// System Constants & Limits
export const MAX_SEARCH_RADIUS_METERS = 50000; // 50 km max configurable radius
export const DEFAULT_SEARCH_RADIUS_METERS = 10000; // 10 km default radius
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

// Configurable Ranking Engine Default Weights (Development Configuration)
export const DEFAULT_PRICE_NORMALIZATION_MINUTES = 50;

export const DEFAULT_SEARCH_RANKING_CONFIG: SearchRankingConfiguration = {
  distanceWeight: 0.35,
  ratingWeight: 0.25,
  priceWeight: 0.20,
  availabilityWeight: 0.20,
  priceNormalizationMinutes: DEFAULT_PRICE_NORMALIZATION_MINUTES,
  benchmarkPriceInCents: 12000,
  slotDensityMinScore: 0.3,
  slotDensityMaxScore: 1.0,
  slotDensityScaleBaseSlots: 15,
};

// Known Sao Paulo Neighborhood Centroids for Location Privacy Mapping
const NEIGHBORHOOD_PUBLIC_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  pinheiros: { lat: -23.5658, lng: -46.6872 },
  'bela vista': { lat: -23.5587, lng: -46.6483 },
  'vila mariana': { lat: -23.5891, lng: -46.6342 },
  moema: { lat: -23.6019, lng: -46.6622 },
  santana: { lat: -23.5025, lng: -46.6247 },
  tatuapé: { lat: -23.5398, lng: -46.5765 },
  tatuape: { lat: -23.5398, lng: -46.5765 },
  'itaim bibi': { lat: -23.5852, lng: -46.6811 },
  'santo amaro': { lat: -23.6521, lng: -46.7092 },
};

// Known Regional City/Administrative Centroids for Fallback Location Mapping
const REGIONAL_PUBLIC_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'são paulo': { lat: -23.5505, lng: -46.6333 },
  'sao paulo': { lat: -23.5505, lng: -46.6333 },
  guarulhos: { lat: -23.4628, lng: -46.5333 },
  campinas: { lat: -22.9099, lng: -47.0626 },
  'santo andré': { lat: -23.6639, lng: -46.5383 },
  'santo andre': { lat: -23.6639, lng: -46.5383 },
  'são bernardo do campo': { lat: -23.6939, lng: -46.565 },
  'sao bernardo do campo': { lat: -23.6939, lng: -46.565 },
  osasco: { lat: -23.5325, lng: -46.7917 },
};

/**
 * Validates and sanitizes an incoming SearchRequest.
 */
export function validateSearchRequest(req: SearchRequest): {
  isValid: boolean;
  errors: string[];
  sanitized: SearchRequest;
} {
  const errors: string[] = [];

  const sanitized: SearchRequest = {
    ...req,
    radiusMeters: req.radiusMeters || DEFAULT_SEARCH_RADIUS_METERS,
    providerType: req.providerType || 'ALL',
    transmission: req.transmission || 'ALL',
    page: Math.max(1, req.page || 1),
    limit: Math.min(MAX_PAGE_SIZE, Math.max(1, req.limit || DEFAULT_PAGE_SIZE)),
    sortBy: req.sortBy || 'RECOMMENDED',
  };

  if (req.latitude !== undefined) {
    if (typeof req.latitude !== 'number' || req.latitude < -90 || req.latitude > 90) {
      errors.push('Latitude must be a valid number between -90 and 90');
    }
  }

  if (req.longitude !== undefined) {
    if (typeof req.longitude !== 'number' || req.longitude < -180 || req.longitude > 180) {
      errors.push('Longitude must be a valid number between -180 and 180');
    }
  }

  if (sanitized.radiusMeters! <= 0 || sanitized.radiusMeters! > MAX_SEARCH_RADIUS_METERS) {
    errors.push(`radiusMeters must be between 1 and ${MAX_SEARCH_RADIUS_METERS} meters (50km)`);
  }

  if (req.category && !['A', 'B'].includes(req.category)) {
    errors.push('Category must be either "A" or "B" for MVP');
  }

  if (req.minPriceInCents !== undefined && req.minPriceInCents < 0) {
    errors.push('minPriceInCents cannot be negative');
  }

  if (
    req.maxPriceInCents !== undefined &&
    req.minPriceInCents !== undefined &&
    req.maxPriceInCents < req.minPriceInCents
  ) {
    errors.push('maxPriceInCents cannot be smaller than minPriceInCents');
  }

  if (req.minimumRating !== undefined && (req.minimumRating < 0 || req.minimumRating > 5)) {
    errors.push('minimumRating must be between 0 and 5');
  }

  if (req.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.date)) {
      errors.push('date must be in YYYY-MM-DD format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * REFERENCE IMPLEMENTATION / DEVELOPMENT FALLBACK / UNIT TEST HELPER
 * Calculates Haversine distance in meters between two GPS coordinates.
 * NOTE: Production source of truth is PostGIS ST_DWithin / ST_Distance on GEOGRAPHY(Point,4326).
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats distance in meters to a public sanitized representation.
 * Rounds distance to nearest 100m (roundedDistanceMeters) and formats to 1 decimal place (formattedDistance)
 * to resist spatial triangulation attacks against residential provider coordinates.
 */
export function formatPublicDistance(distanceMeters: number): {
  distanceKm: number;
  formattedDistance: string;
  roundedDistanceMeters: number;
} {
  const roundedDistanceMeters = Math.round(distanceMeters / 100) * 100;
  const distanceKm = Math.round((roundedDistanceMeters / 1000) * 10) / 10;
  const formattedDistance = `${distanceKm.toString().replace('.', ',')} km`;
  return { distanceKm, formattedDistance, roundedDistanceMeters };
}

/**
 * Generates a public map location for Leaflet display.
 * CRITICAL PRIVACY REQUIREMENT: NEVER returns the exact residential coordinate or street address.
 * NEVER derives public coordinates by adding offset to private residential lat/long.
 * Location Source Hierarchy:
 * 1. MEETING_POINT: Explicit public meeting point configured on Provider entity.
 * 2. SERVICE_AREA: Service area center point configured on Provider entity.
 * 3. NEIGHBORHOOD_CENTROID: Recognized public neighborhood centroid.
 * 4. REGIONAL_CENTROID: Recognized city or regional administrative centroid.
 * 5. UNAVAILABLE: Safe text-only fallback (no location coordinates exposed).
 */
export function getPublicMapLocation(provider: Provider): PublicMapLocation {
  // 1. Configured Public Meeting Point
  if (provider.meetingPointLatitude !== undefined && provider.meetingPointLongitude !== undefined) {
    return {
      latitude: provider.meetingPointLatitude,
      longitude: provider.meetingPointLongitude,
      type: 'MEETING_POINT',
      label: provider.meetingPointName || `Ponto de Encontro — ${provider.neighborhood || provider.city}`,
    };
  }

  // 2. Service Area Center
  if (provider.serviceAreaCenterLatitude !== undefined && provider.serviceAreaCenterLongitude !== undefined) {
    return {
      latitude: provider.serviceAreaCenterLatitude,
      longitude: provider.serviceAreaCenterLongitude,
      type: 'SERVICE_AREA',
      label: `Área de Atendimento — ${provider.neighborhood || provider.city}`,
    };
  }

  // 3. Neighborhood Centroid
  const normalizedNeigh = (provider.neighborhood || '').toLowerCase().trim();
  if (normalizedNeigh && NEIGHBORHOOD_PUBLIC_CENTROIDS[normalizedNeigh]) {
    const centroid = NEIGHBORHOOD_PUBLIC_CENTROIDS[normalizedNeigh];
    return {
      latitude: centroid.lat,
      longitude: centroid.lng,
      type: 'NEIGHBORHOOD_CENTROID',
      label: `${provider.neighborhood}, ${provider.city}`,
    };
  }

  // 4. Regional / City Centroid
  const normalizedCity = (provider.city || '').toLowerCase().trim();
  if (normalizedCity && REGIONAL_PUBLIC_CENTROIDS[normalizedCity]) {
    const reg = REGIONAL_PUBLIC_CENTROIDS[normalizedCity];
    return {
      latitude: reg.lat,
      longitude: reg.lng,
      type: 'REGIONAL_CENTROID',
      label: `${provider.city} (Centro Regional)`,
    };
  }

  // Default regional center for São Paulo region
  if (!provider.city || provider.city.toLowerCase().includes('são paulo') || provider.city.toLowerCase().includes('sao paulo')) {
    return {
      latitude: -23.5505,
      longitude: -46.6333,
      type: 'REGIONAL_CENTROID',
      label: 'São Paulo (Região)',
    };
  }

  // 5. Safe Text-Only Fallback (Zero coordinate leakage)
  return {
    type: 'UNAVAILABLE',
    label: provider.neighborhood ? `${provider.neighborhood}, ${provider.city}` : provider.city || 'Região não informada',
  };
}

/**
 * Computes normalized price per duration unit to allow fair comparison across different class durations.
 * Defaults to 50 minutes (DEFAULT_PRICE_NORMALIZATION_MINUTES).
 */
export function calculateNormalizedPricePerFiftyMinInCents(
  priceInCents: number,
  durationMinutes: number,
  targetNormalizationMinutes: number = DEFAULT_PRICE_NORMALIZATION_MINUTES
): number {
  if (durationMinutes <= 0) return priceInCents;
  return Math.round((priceInCents / durationMinutes) * targetNormalizationMinutes);
}

/**
 * Normalizes slot density score using a smooth logarithmic curve capped between minScore and maxScore.
 * Configurable via SearchRankingConfiguration.
 */
export function normalizeSlotDensityScore(
  availableSlotCount: number,
  config: SearchRankingConfiguration = DEFAULT_SEARCH_RANKING_CONFIG
): number {
  const minScore = config.slotDensityMinScore ?? 0.3;
  const maxScore = config.slotDensityMaxScore ?? 1.0;
  const baseSlots = config.slotDensityScaleBaseSlots ?? 15;

  if (availableSlotCount <= 0) return minScore;
  const scaled = Math.log2(1 + availableSlotCount) / Math.log2(1 + baseSlots);
  return Math.round(Math.min(maxScore, minScore + (maxScore - minScore) * scaled) * 1000) / 1000;
}

/**
 * Sanitizes and transforms private Provider entity into a PublicSearchProviderResult DTO.
 * STRICT SECURITY AUDIT: Strips out CPF, CNPJ, CNH, exact residential lat/long, exact street address,
 * license plates, compliance documents, internal notes, and banking information.
 */
export function sanitizePublicSearchProviderResult(
  provider: Provider,
  publicOfferings: PublicOfferingSummary[],
  distanceMeters: number,
  availableSlotCount: number,
  availableResourceCount: number,
  nextAvailableCandidate?: AvailabilityCandidate,
  rankingScore: number = 0
): PublicSearchProviderResult {
  const { distanceKm, formattedDistance, roundedDistanceMeters } = formatPublicDistance(distanceMeters);
  const publicMapLocation = getPublicMapLocation(provider);

  let nextAvailableSlot = provider.nextAvailableSlot;
  if (nextAvailableCandidate) {
    nextAvailableSlot = `${nextAvailableCandidate.date} às ${nextAvailableCandidate.startTime}`;
  } else if (availableSlotCount === 0) {
    nextAvailableSlot = 'Sem horários disponíveis no período';
  }

  // Determine lowest normalized and nominal price among filtered public offerings
  const startingPriceInCents =
    publicOfferings.length > 0
      ? Math.min(...publicOfferings.map((o) => o.priceInCents))
      : provider.startingPriceInCents;
  let normalizedPricePerFiftyMinInCents = startingPriceInCents;

  if (publicOfferings.length > 0) {
    const normPrices = publicOfferings.map((o) =>
      calculateNormalizedPricePerFiftyMinInCents(o.priceInCents, o.durationMinutes)
    );
    normalizedPricePerFiftyMinInCents = Math.min(...normPrices);
  }

  const effectiveCategories =
    publicOfferings.length > 0
      ? Array.from(new Set(publicOfferings.map((o) => o.category)))
      : provider.categories;

  const effectiveTransmissions =
    publicOfferings.length > 0
      ? Array.from(new Set(publicOfferings.map((o) => o.transmission)))
      : provider.transmissions;

  return {
    providerId: provider.id,
    displayName: provider.name,
    providerType: provider.type,
    avatarUrl: provider.avatarUrl,
    verificationBadge: provider.isVerified ? 'Verificado pela plataforma' : 'Em verificação',
    isVerified: provider.isVerified,
    ratingAverage: provider.ratingAverage || 0,
    ratingCount: provider.ratingCount || 0,
    ratingSource: 'DEMO', // DEMO data marker until Sprint 13 Reviews Engine
    approximateDistanceKm: distanceKm,
    roundedDistanceMeters,
    formattedDistance,
    neighborhood: provider.neighborhood,
    city: provider.city,
    categories: effectiveCategories,
    transmissions: effectiveTransmissions,
    startingPriceInCents,
    normalizedPricePerFiftyMinInCents,
    publicOfferings,
    availableSlotCount,
    availableResourceCount,
    nextAvailableSlot,
    nextAvailableCandidate,
    publicMapLocation,
    rankingScore,
  };
}

/**
 * Computes deterministic ranking score based on configurable weights and normalized unit metrics.
 */
export function computeRankingScore(
  distanceMeters: number,
  ratingAverage: number,
  normalizedPriceInCents: number,
  availableSlotCount: number,
  searchRadiusMeters: number,
  config: SearchRankingConfiguration = DEFAULT_SEARCH_RANKING_CONFIG
): number {
  // 1. Distance score (1 = at user location, 0 = at search radius boundary)
  const radius = Math.max(100, searchRadiusMeters);
  const distanceRatio = Math.min(1, distanceMeters / radius);
  const distanceScore = Math.max(0, 1 - distanceRatio);

  // 2. Rating score (0..1)
  const ratingScore = Math.min(1, Math.max(0, ratingAverage / 5));

  // 3. Price score (normalized price relative to benchmark)
  const benchmarkPrice = config.benchmarkPriceInCents ?? 12000;
  const priceRatio = Math.min(1, normalizedPriceInCents / benchmarkPrice);
  const priceScore = Math.max(0, 1 - priceRatio);

  // 4. Availability score (logarithmic slot density score 0.3..1.0)
  const availabilityScore = normalizeSlotDensityScore(availableSlotCount, config);

  const totalScore =
    distanceScore * config.distanceWeight +
    ratingScore * config.ratingWeight +
    priceScore * config.priceWeight +
    availabilityScore * config.availabilityWeight;

  return Math.round(totalScore * 1000) / 1000;
}

export interface SearchExecutionPipelineOptions {
  providers: Provider[];
  vehicles: Vehicle[];
  offerings: ServiceOffering[];
  availabilityRules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  existingBookings: Booking[];
  searchRequest: SearchRequest;
  rankingConfig?: SearchRankingConfiguration;
  referenceTime?: Date;
}

/**
 * EXECUTE PUBLIC SEARCH PIPELINE (Backend / Domain Engine)
 *
 * Execution Order:
 * 1. Validate & Sanitize SearchRequest parameters
 * 2. Filter ACTIVE Providers
 * 3. Spatial Distance Filter (ST_DWithin PostGIS in DB / Haversine reference in TS fallback)
 * 4. Provider Type & Rating Eligibility Filter
 * 5. Filter ACTIVE Vehicles & ACTIVE Offerings matching Category, Transmission & Normalized Price
 * 6. Generate Availability Candidates (ONLY for candidates passing all prior filters)
 * 7. CFC (Driving School) Resource Candidate Aggregation
 * 8. Apply Configurable Ranking Engine with Normalized Metrics
 * 9. Global Sort & Deterministic Tie-Breaker (provider.id)
 * 10. Global Pagination & DTO Sanitization
 */
export function executePublicSearch(
  options: SearchExecutionPipelineOptions
): SearchResultResponse {
  const startTimeMs = Date.now();
  const { isValid, errors, sanitized } = validateSearchRequest(options.searchRequest);

  if (!isValid) {
    throw new SearchValidationError(errors);
  }

  const userLat = sanitized.latitude ?? -23.5658; // Default to Pinheiros, SP if lat not provided
  const userLng = sanitized.longitude ?? -46.6872;
  const radiusMeters = sanitized.radiusMeters!;
  const rankingConfig = options.rankingConfig || DEFAULT_SEARCH_RANKING_CONFIG;
  const referenceNow = options.referenceTime || new Date();

  const providers = options.providers || [];
  const vehicles = options.vehicles || [];
  const offerings = options.offerings || [];
  const availabilityRules = options.availabilityRules || [];
  const exceptions = options.exceptions || [];
  const existingBookings = options.existingBookings || [];

  // Step 1: Filter ACTIVE Providers
  const activeProviders = providers.filter((p) => p.status === 'ACTIVE');

  const candidatesResults: {
    provider: Provider;
    publicOfferings: PublicOfferingSummary[];
    distanceMeters: number;
    availableSlotCount: number;
    availableResourceCount: number;
    nextCandidate?: AvailabilityCandidate;
    rankingScore: number;
  }[] = [];

  for (const provider of activeProviders) {
    // Step 2: Spatial Radius Filter (In-Memory Reference Fallback for PostGIS ST_DWithin)
    const provLat = provider.latitude ?? -23.5658;
    const provLng = provider.longitude ?? -46.6872;
    const distanceMeters = calculateHaversineDistanceMeters(userLat, userLng, provLat, provLng);

    if (distanceMeters > radiusMeters) {
      continue; // Outside search radius boundary
    }

    // Step 3: Provider Type & Rating Filter
    if (sanitized.providerType && sanitized.providerType !== 'ALL') {
      if (provider.type !== sanitized.providerType) {
        continue;
      }
    }

    if (sanitized.minimumRating !== undefined) {
      if ((provider.ratingAverage || 0) < sanitized.minimumRating) {
        continue;
      }
    }

    // Step 4: Filter ACTIVE Vehicles & ACTIVE Offerings for this Provider
    const providerVehicles = vehicles.filter(
      (v) => v.providerId === provider.id && v.status === 'ACTIVE'
    );

    if (providerVehicles.length === 0) {
      continue; // No active vehicle
    }

    let providerOfferings = offerings.filter(
      (o) => o.providerId === provider.id && o.status === 'ACTIVE'
    );

    // Filter by Category if specified
    if (sanitized.category) {
      providerOfferings = providerOfferings.filter((o) => o.category === sanitized.category);
    }

    // Filter by Transmission if specified
    if (sanitized.transmission && sanitized.transmission !== 'ALL') {
      providerOfferings = providerOfferings.filter((o) => {
        const matchingVehicle = providerVehicles.find((v) => v.id === o.vehicleId);
        return matchingVehicle && matchingVehicle.transmission === sanitized.transmission;
      });
    }

    // Filter by Price Range if specified
    if (sanitized.minPriceInCents !== undefined) {
      providerOfferings = providerOfferings.filter((o) => o.priceInCents >= sanitized.minPriceInCents!);
    }
    if (sanitized.maxPriceInCents !== undefined) {
      providerOfferings = providerOfferings.filter((o) => o.priceInCents <= sanitized.maxPriceInCents!);
    }

    if (providerOfferings.length === 0) {
      continue; // No offering matches requested parameters
    }

    // Transform Offerings into Public Summaries
    const publicOfferings: PublicOfferingSummary[] = providerOfferings.map((o) => {
      const v = providerVehicles.find((veh) => veh.id === o.vehicleId)!;
      return {
        id: o.id,
        vehicleId: v ? v.id : o.vehicleId,
        vehicleTitle: v ? `${v.brand} ${v.model}` : 'Veículo da Autoescola',
        vehicleType: v ? v.vehicleType : 'CAR',
        category: o.category,
        transmission: v ? v.transmission : 'MANUAL',
        photos: v ? v.photos : [],
        durationMinutes: o.durationMinutes,
        priceInCents: o.priceInCents,
      };
    });

    // Step 5: Generate Availability Candidates ONLY after passing spatial & offering filters
    let allGeneratedCandidates: AvailabilityCandidate[] = [];
    const searchDate = sanitized.date || referenceNow.toISOString().split('T')[0];

    for (const offering of providerOfferings) {
      const provRules = availabilityRules.filter((r) => r.providerId === provider.id);
      const provExceptions = exceptions.filter((ex) => ex.providerId === provider.id);
      const provBookings = existingBookings.filter((b) => b.providerId === provider.id);

      const slots = generateAvailableSlots({
        offering,
        provider,
        vehicles: providerVehicles,
        startDate: searchDate,
        endDate: searchDate,
        now: referenceNow,
        availabilityRules: provRules,
        exceptions: provExceptions,
        existingBookings: provBookings,
        minimumNoticeMinutes: DEFAULT_DEVELOPMENT_CONFIGURATION.noticeMinutes,
        maxAdvanceDays: AVAILABILITY_SEARCH_HORIZON_DAYS,
      });

      allGeneratedCandidates.push(...slots);
    }

    // Filter Candidates by timeRange if specified
    if (sanitized.timeRange) {
      const { startTime, endTime } = sanitized.timeRange;
      if (startTime) {
        allGeneratedCandidates = allGeneratedCandidates.filter((c) => c.startTime >= startTime);
      }
      if (endTime) {
        allGeneratedCandidates = allGeneratedCandidates.filter((c) => c.endTime <= endTime);
      }
    }

    // If explicit date or time range was requested and NO candidates exist, exclude provider from bookable search
    if ((sanitized.date || sanitized.timeRange) && allGeneratedCandidates.length === 0) {
      continue;
    }

    // Step 6: CFC (Driving School) Resource Candidate Aggregation
    const distinctTimes = new Set(allGeneratedCandidates.map((c) => c.startTime));
    const availableSlotCount = distinctTimes.size;

    // Distinct instructor/vehicle pairs
    const distinctResourcePairs = new Set(
      allGeneratedCandidates.map((c) => `${c.instructorId}_${c.vehicleId}`)
    );
    const availableResourceCount = Math.max(1, distinctResourcePairs.size);

    const nextCandidate = allGeneratedCandidates.length > 0 ? allGeneratedCandidates[0] : undefined;

    // Step 7: Compute Normalized Price and Ranking Score
    const normPrices = publicOfferings.map((o) =>
      calculateNormalizedPricePerFiftyMinInCents(o.priceInCents, o.durationMinutes)
    );
    const lowestNormPrice = normPrices.length > 0 ? Math.min(...normPrices) : provider.startingPriceInCents;

    const rankingScore = computeRankingScore(
      distanceMeters,
      provider.ratingAverage || 0,
      lowestNormPrice,
      availableSlotCount,
      radiusMeters,
      rankingConfig
    );

    candidatesResults.push({
      provider,
      publicOfferings,
      distanceMeters,
      availableSlotCount,
      availableResourceCount,
      nextCandidate,
      rankingScore,
    });
  }

  // Step 8: Apply Sorting Globally across candidate pool
  candidatesResults.sort((a, b) => {
    if (sanitized.sortBy === 'DISTANCE') {
      if (a.distanceMeters !== b.distanceMeters) {
        return a.distanceMeters - b.distanceMeters;
      }
    } else if (sanitized.sortBy === 'RATING') {
      const rA = a.provider.ratingAverage || 0;
      const rB = b.provider.ratingAverage || 0;
      if (rA !== rB) {
        return rB - rA; // DESC
      }
    } else if (sanitized.sortBy === 'PRICE_ASC') {
      const priceA = a.publicOfferings.length > 0 ? Math.min(...a.publicOfferings.map((o) => o.priceInCents)) : a.provider.startingPriceInCents;
      const priceB = b.publicOfferings.length > 0 ? Math.min(...b.publicOfferings.map((o) => o.priceInCents)) : b.provider.startingPriceInCents;
      if (priceA !== priceB) {
        return priceA - priceB;
      }
    } else if (sanitized.sortBy === 'PRICE_DESC') {
      const priceA = a.publicOfferings.length > 0 ? Math.min(...a.publicOfferings.map((o) => o.priceInCents)) : a.provider.startingPriceInCents;
      const priceB = b.publicOfferings.length > 0 ? Math.min(...b.publicOfferings.map((o) => o.priceInCents)) : b.provider.startingPriceInCents;
      if (priceA !== priceB) {
        return priceB - priceA;
      }
    }

    // Default 'RECOMMENDED' or Tie-breaker
    if (b.rankingScore !== a.rankingScore) {
      return b.rankingScore - a.rankingScore;
    }
    if (a.distanceMeters !== b.distanceMeters) {
      return a.distanceMeters - b.distanceMeters;
    }
    // Stable deterministic tie-breaker
    return a.provider.id.localeCompare(b.provider.id);
  });

  // Step 9: Global Pagination
  const totalCount = candidatesResults.length;
  const page = sanitized.page!;
  const limit = sanitized.limit!;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedCandidates = candidatesResults.slice(startIndex, startIndex + limit);

  // Step 10: Sanitize Public DTOs
  const sanitizedResults: PublicSearchProviderResult[] = paginatedCandidates.map((item) =>
    sanitizePublicSearchProviderResult(
      item.provider,
      item.publicOfferings,
      item.distanceMeters,
      item.availableSlotCount,
      item.availableResourceCount,
      item.nextCandidate,
      item.rankingScore
    )
  );

  const executionTimeMs = Date.now() - startTimeMs;

  return {
    results: sanitizedResults,
    totalCount,
    page,
    totalPages,
    hasMore: page < totalPages,
    appliedFilters: sanitized,
    executionTimeMs,
  };
}
