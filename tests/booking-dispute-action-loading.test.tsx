// @vitest-environment happy-dom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/db-service', () => ({
  dbService: {
    getMyBookingDisputes: vi.fn(),
  },
}));

import { BookingDisputePanel } from '../src/components/booking/BookingDisputePanel';

describe('BookingDisputePanel action loading state', () => {
  afterEach(() => cleanup());

  it('does not flash a red contestation button while disputes are loading', () => {
    render(
      <BookingDisputePanel
        booking={{ id: 'booking-1', status: 'COMPLETED' } as any}
        currentUserId="student-1"
        display="action"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Ver contestação' })).toBeNull();
  });
});
