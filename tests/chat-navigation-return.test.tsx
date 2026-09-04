// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookingChatPanel } from '../src/components/chat/BookingChatPanel';
import { Booking } from '../src/types';

vi.mock('../src/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'student-123', role: 'STUDENT', roles: ['STUDENT'] },
  }),
}));

const { getConversationForBooking, getMessagesForConversation } = vi.hoisted(() => ({
  getConversationForBooking: vi.fn().mockResolvedValue({ id: 'convo-1', bookingId: 'booking-1' }),
  getMessagesForConversation: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/lib/db-service', () => ({
  dbService: {
    getConversationForBooking,
    getMessagesForConversation,
    sendMessage: vi.fn(),
  },
  mapMessageFromDb: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    channel: () => ({
      on: () => ({
        subscribe: (cb: any) => { cb('SUBSCRIBED'); },
      }),
    }),
    removeChannel: vi.fn(),
  },
}));

const mockBooking: Booking = {
  id: 'booking-uuid-1234',
  studentId: 'student-123',
  instructorId: 'inst-1',
  providerId: 'prov-1',
  status: 'CONFIRMED',
  scheduledDate: '2026-08-31',
  startTime: '08:00',
  endTime: '08:50',
  instructorName: 'LUCAS SANTOS MIRANDA',
  providerName: 'LUCAS SANTOS MIRANDA',
  vehicleName: 'BMW X1 SDRIVE 20i',
  snapshot: {
    priceInCents: 20000,
    platformFeeInCents: 200,
    totalInCents: 20000,
    category: 'B',
    transmission: 'AUTOMATIC',
  } as any,
  totalInCents: 20000,
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
} as unknown as Booking;

describe('BookingChatPanel Return Navigation & V3 Design', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders modern hero header and triggers onBack callback when clicked', async () => {
    const handleBack = vi.fn();
    render(<React.StrictMode><BookingChatPanel booking={mockBooking} onBack={handleBack} /></React.StrictMode>);

    expect(screen.getByText('Conversa da aula')).toBeTruthy();
    expect(screen.getByText('LUCAS SANTOS MIRANDA')).toBeTruthy();
    expect(screen.getByText('Voltar aos detalhes')).toBeTruthy();

    const backButton = screen.getByRole('button', { name: /voltar para os detalhes da aula/i });
    fireEvent.click(backButton);

    expect(handleBack).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(getConversationForBooking).toHaveBeenCalledTimes(1);
      expect(getMessagesForConversation).toHaveBeenCalledTimes(1);
    });
  });
});
