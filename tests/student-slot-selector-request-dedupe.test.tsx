// @vitest-environment happy-dom
import React, { StrictMode } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from '../src/lib/supabase';
import { SlotSelectorModal } from '../src/apps/student/components/SlotSelectorModal';

describe('SlotSelectorModal request deduplication', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('coalesces StrictMode effect replays into one horizon and one slots load', async () => {
    const rpc = supabase.rpc as any;
    rpc.mockImplementation(async (functionName) => {
      if (functionName === 'get_public_booking_horizon_days') {
        return { data: 30, error: null } as any;
      }
      if (functionName === 'get_available_slots_public') {
        return { data: [], error: null } as any;
      }
      return { data: null, error: null } as any;
    });

    render(
      <StrictMode>
        <SlotSelectorModal
          isOpen
          onClose={vi.fn()}
          offeringId="offering-1"
          onSelect={vi.fn()}
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('get_available_slots_public', expect.any(Object));
    });

    expect(rpc.mock.calls.filter(([name]) => name === 'get_public_booking_horizon_days')).toHaveLength(1);
    expect(rpc.mock.calls.filter(([name]) => name === 'get_available_slots_public')).toHaveLength(1);
  });
});
