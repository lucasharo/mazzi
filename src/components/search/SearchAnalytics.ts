// ============================================================================
// MAZZI PLATFORM — SEARCH PRIVACY ANALYTICS
// Persists only allowlisted product events through Supabase RPC.
// No runtime mocks, no in-memory store, no precise GPS, no PII.
// ============================================================================

import { dbService } from '../../lib/db-service';
import { ProductAnalyticsEventName } from '../../types';

export type SearchEventType =
  | 'SEARCH_PERFORMED'
  | 'FILTER_APPLIED'
  | 'PROVIDER_VIEWED'
  | 'SLOT_VIEWED';

export interface SearchAnalyticsPayload {
  eventType: SearchEventType;
  regionLabel?: string;
  category?: string;
  providerType?: string;
  resultCount?: number;
  providerId?: string;
  timestamp?: string;
  sortBy?: string;
  radiusMeters?: number;
}

const EVENT_MAP: Record<SearchEventType, ProductAnalyticsEventName> = {
  SEARCH_PERFORMED: 'PROVIDER_SEARCH',
  FILTER_APPLIED: 'PROVIDER_SEARCH',
  PROVIDER_VIEWED: 'PROVIDER_PROFILE_VIEW',
  SLOT_VIEWED: 'AVAILABLE_SLOTS_VIEW',
};

function toRadiusBucket(radiusMeters?: number): string | undefined {
  if (!radiusMeters || radiusMeters <= 0) return undefined;
  if (radiusMeters <= 3000) return '0_3km';
  if (radiusMeters <= 5000) return '3_5km';
  if (radiusMeters <= 10000) return '5_10km';
  return '10km_plus';
}

function sanitizeProperties(payload: Omit<SearchAnalyticsPayload, 'timestamp'>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  if (payload.category) properties.category = payload.category;
  if (payload.providerType) properties.provider_type = payload.providerType;
  if (typeof payload.resultCount === 'number') properties.results_count = payload.resultCount;
  if (payload.sortBy) properties.sort_by = payload.sortBy;

  const radiusBucket = toRadiusBucket(payload.radiusMeters);
  if (radiusBucket) properties.radius_bucket = radiusBucket;

  // Do not persist providerId, exact region labels, lat/lng, student identifiers,
  // chat/review content, document data or payment details in analytics_events.
  return properties;
}

/**
 * Tracks search funnel events without blocking the UI.
 */
export function trackSearchAnalytics(payload: Omit<SearchAnalyticsPayload, 'timestamp'>): void {
  const eventName = EVENT_MAP[payload.eventType];
  const properties = sanitizeProperties(payload);

  void dbService.trackAnalyticsEvent(eventName, properties).catch((error) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[MAZZI Analytics] Event rejected or unavailable:', error);
    }
  });
}

/**
 * Legacy test/debug accessor kept intentionally empty because Sprint 14 removed
 * runtime in-memory analytics storage.
 */
export function getSearchAnalyticsLogs(): SearchAnalyticsPayload[] {
  return [];
}
