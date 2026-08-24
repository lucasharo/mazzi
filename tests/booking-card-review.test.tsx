// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingCard } from '../src/components/ui/BookingCard';
import { Booking } from '../src/types';

const completedBooking: Booking = {
  id: 'booking-review-1',
  studentId: 'student-1',
  providerId: 'provider-1',
  providerName: 'Autoescola Paulista',
  instructorId: 'instructor-1',
  instructorName: 'Instrutor Carlos',
  vehicleId: 'vehicle-1',
  vehicleName: 'Chevrolet Onix',
  offeringId: 'offering-1',
  category: 'B',
  scheduledDate: '2026-08-22',
  startTime: '08:00',
  endTime: '08:50',
  scheduledStartAt: '2026-08-22T08:00:00Z',
  scheduledEndAt: '2026-08-22T08:50:00Z',
  status: 'COMPLETED',
  snapshot: {
    providerId: 'provider-1',
    providerName: 'Autoescola Paulista',
    providerType: 'DRIVING_SCHOOL',
    instructorId: 'instructor-1',
    instructorName: 'Instrutor Carlos',
    vehicleId: 'vehicle-1',
    vehicleName: 'Chevrolet Onix',
    transmission: 'MANUAL',
    category: 'B',
    durationMinutes: 50,
    priceInCents: 9500,
    platformFeeInCents: 950,
    totalInCents: 10450,
    meetingPoint: 'Paulista, São Paulo',
  },
  meetingPoint: 'Paulista, São Paulo',
  priceInCents: 9500,
  platformFeeInCents: 950,
  totalInCents: 10450,
  createdAt: '2026-08-20T10:00:00Z',
};

describe('BookingCard completed lesson review CTA', () => {
  afterEach(cleanup);

  it('renders the review action and sends the exact booking UUID', () => {
    const onReview = vi.fn();
    render(<BookingCard booking={completedBooking} onReview={onReview} />);

    const reviewButton = screen.getByRole('button', { name: 'Avaliar instrutor' });
    fireEvent.click(reviewButton);

    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onReview).toHaveBeenCalledWith(completedBooking);
  });

  it('does not render the review CTA when no callback is supplied', () => {
    render(<BookingCard booking={completedBooking} />);
    expect(screen.queryByRole('button', { name: 'Avaliar instrutor' })).toBeNull();
  });

  it('keeps the details action available alongside the review action', () => {
    render(<BookingCard booking={completedBooking} onReview={vi.fn()} onViewDetails={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Avaliar instrutor' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver detalhes completos da reserva' })).toBeTruthy();
  });
});
