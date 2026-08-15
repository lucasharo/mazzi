// ============================================================================
// MAZZI PLATFORM — SEARCH PRIVACY ANALYTICS
// Audit-compliant search telemetry. Logs aggregated usage signals WITHOUT
// persisting exact GPS coordinates or personal identifying information.
// ============================================================================

export type SearchEventType =
  | 'SEARCH_PERFORMED'
  | 'FILTER_APPLIED'
  | 'PROVIDER_VIEWED'
  | 'SLOT_VIEWED';

export interface SearchAnalyticsPayload {
  eventType: SearchEventType;
  regionLabel?: string; // e.g. "Pinheiros, São Paulo"
  category?: string; // 'A' or 'B'
  providerType?: string;
  resultCount?: number;
  providerId?: string;
  timestamp: string;
}

const analyticsLogStore: SearchAnalyticsPayload[] = [];

/**
 * Tracks a search event while guaranteeing user location privacy.
 */
export function trackSearchAnalytics(payload: Omit<SearchAnalyticsPayload, 'timestamp'>): void {
  const event: SearchAnalyticsPayload = {
    ...payload,
    timestamp: new Date().toISOString(),
  };

  analyticsLogStore.push(event);

  if (process.env.NODE_ENV !== 'production') {
    // Silent console log for dev observability
    // console.log('[MAZZI Search Analytics]', event);
  }
}

export function getSearchAnalyticsLogs(): SearchAnalyticsPayload[] {
  return [...analyticsLogStore];
}
