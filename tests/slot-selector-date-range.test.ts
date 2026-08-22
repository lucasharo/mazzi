import { describe, expect, it } from 'vitest';
import { splitDateRange } from '../src/apps/student/components/SlotSelectorModal';

describe('SlotSelectorModal date range batching', () => {
  it('keeps every RPC request within the 31-day contract', () => {
    expect(splitDateRange('2026-08-22', 60)).toEqual([
      { from: '2026-08-22', to: '2026-09-21' },
      { from: '2026-09-22', to: '2026-10-20' },
    ]);
  });

  it('uses one request for the initial 30-day window', () => {
    expect(splitDateRange('2026-08-22', 30)).toEqual([
      { from: '2026-08-22', to: '2026-09-20' },
    ]);
  });
});
