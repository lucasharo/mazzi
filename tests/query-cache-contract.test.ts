import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { CACHE_POLICY } from '../src/lib/query-client';
import { queryKeys } from '../src/lib/query-keys';

describe('MAZZI query cache contract', () => {
  it('deduplicates simultaneous requests with the same canonical key', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let calls = 0;
    const queryKey = queryKeys.student.bookings('student-1');
    const queryFn = async () => {
      calls += 1;
      await Promise.resolve();
      return ['booking-1'];
    };

    await Promise.all([
      client.fetchQuery({ queryKey, queryFn, staleTime: 30_000 }),
      client.fetchQuery({ queryKey, queryFn, staleTime: 30_000 }),
    ]);

    expect(calls).toBe(1);
    client.clear();
  });

  it('keeps instructor-specific provider keys isolated inside the same school', () => {
    expect(queryKeys.provider.bookings('school-1', 'instructor:carlos')).not.toEqual(
      queryKeys.provider.bookings('school-1', 'instructor:ana'),
    );
    expect(queryKeys.provider.dashboard('school-1', 'instructor:carlos')).not.toEqual(
      queryKeys.provider.dashboard('school-1', 'instructor:ana'),
    );
  });

  it('uses conservative policy defaults and keeps critical state non-persistent by contract', () => {
    expect(CACHE_POLICY.long.staleTime).toBeGreaterThan(CACHE_POLICY.short.staleTime);
    expect(CACHE_POLICY.critical.staleTime).toBe(0);
    expect(queryKeys.provider.instantOffers('school-1', 'carlos')).toContain('offers');
  });
});
