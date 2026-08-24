// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewModal } from '../src/components/reviews/ReviewModal';
import { dbService } from '../src/lib/db-service';
import { Booking, Review } from '../src/types';

const booking: Booking = {
  id: 'booking-review-modal-1',
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
    providerId: 'provider-1', providerName: 'Autoescola Paulista', providerType: 'DRIVING_SCHOOL',
    instructorId: 'instructor-1', instructorName: 'Instrutor Carlos', vehicleId: 'vehicle-1',
    vehicleName: 'Chevrolet Onix', transmission: 'MANUAL', category: 'B', durationMinutes: 50,
    priceInCents: 9500, platformFeeInCents: 950, totalInCents: 10450, meetingPoint: 'Paulista, São Paulo',
  },
  meetingPoint: 'Paulista, São Paulo', priceInCents: 9500, platformFeeInCents: 950,
  totalInCents: 10450, createdAt: '2026-08-20T10:00:00Z',
};

const submittedReview = (ratingOverall: number, comment = ''): Review => ({
  id: 'review-1', bookingId: booking.id, studentId: booking.studentId, providerId: booking.providerId,
  instructorId: booking.instructorId, ratingOverall, comment, createdAt: '2026-08-22T09:00:00Z',
});

describe('ReviewModal explicit rating contract', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('starts unselected, disables submit, then submits the exact selected rating and comment', async () => {
    vi.spyOn(dbService, 'getReviewForBooking').mockResolvedValue(null);
    const createReview = vi.spyOn(dbService, 'createReviewForBooking').mockResolvedValue(submittedReview(4, 'Excelente.'));
    render(<ReviewModal booking={booking} isOpen={true} onClose={vi.fn()} />);

    const submit = await screen.findByRole('button', { name: 'Enviar avaliação' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Selecione uma nota')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: '4 de 5 estrelas' }));
    expect(screen.getByRole('radio', { name: '4 de 5 estrelas' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: '5 de 5 estrelas' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Sua nota: 4/5')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Conte como foi sua experiência...'), { target: { value: 'Excelente.' } });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(createReview).toHaveBeenCalledWith(booking.id, 4, 'Excelente.'));
  });

  it.each([1, 2, 3, 4, 5])('maps explicit selection %s to the same RPC rating', async (rating) => {
    vi.spyOn(dbService, 'getReviewForBooking').mockResolvedValue(null);
    const createReview = vi.spyOn(dbService, 'createReviewForBooking').mockResolvedValue(submittedReview(rating));
    render(<ReviewModal booking={booking} isOpen={true} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('radio', { name: `${rating} de 5 estrelas` }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));
    await waitFor(() => expect(createReview).toHaveBeenCalledWith(booking.id, rating, ''));
  });

  it('uses the persisted rating when showing an existing review', async () => {
    vi.spyOn(dbService, 'getReviewForBooking').mockResolvedValue(submittedReview(4));
    render(<ReviewModal booking={booking} isOpen={true} onClose={vi.fn()} />);

    expect(await screen.findByText('Avaliação enviada')).toBeTruthy();
    expect(screen.getByText('Nota 4/5')).toBeTruthy();
  });
});
