// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookingChatPanel } from '../src/components/chat/BookingChatPanel';
import { Booking } from '../src/types';

vi.mock('../src/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'student-123', role: 'STUDENT', roles: ['STUDENT'] },
  }),
}));

vi.mock('../src/lib/db-service', () => ({
  dbService: {
    getConversationForBooking: vi.fn().mockResolvedValue({ id: 'convo-1', bookingId: 'booking-1' }),
    getMessagesForConversation: vi.fn().mockResolvedValue([]),
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
  it('renders modern hero header and triggers onBack callback when clicked', () => {
    const handleBack = vi.fn();
    render(<BookingChatPanel booking={mockBooking} onBack={handleBack} />);

    expect(screen.getByText('Conversa da aula')).toBeTruthy();
    expect(screen.getByText('LUCAS SANTOS MIRANDA')).toBeTruthy();
    expect(screen.getByText('Voltar aos detalhes')).toBeTruthy();

    const backButton = screen.getByRole('button', { name: /voltar para os detalhes da aula/i });
    fireEvent.click(backButton);

    expect(handleBack).toHaveBeenCalledTimes(1);
  });
});
