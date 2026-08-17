import { SearchRequest } from '../types';
import { DEFAULT_SEARCH_RADIUS_METERS } from '../domain/search';

export const STUDENT_NAV_ITEMS = ['search', 'bookings', 'messages', 'profile'] as const;

export function countAdditionalStudentFilters(searchRequest: SearchRequest): number {
  return [
    Boolean(searchRequest.date),
    searchRequest.providerType && searchRequest.providerType !== 'ALL',
    searchRequest.transmission && searchRequest.transmission !== 'ALL',
    searchRequest.radiusMeters !== DEFAULT_SEARCH_RADIUS_METERS,
    typeof searchRequest.minimumRating === 'number',
    typeof searchRequest.maxPriceInCents === 'number',
  ].filter(Boolean).length;
}

export function formatStudentResultCount(count: number): string {
  return `${count} ${count === 1 ? 'profissional encontrado' : 'profissionais encontrados'}`;
}
