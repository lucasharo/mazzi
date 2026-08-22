import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProviderResultCard } from '../src/components/search/ProviderResultCard';
import { ProviderPublicProfileModal } from '../src/components/search/ProviderPublicProfileModal';
import { BookingCard } from '../src/components/ui/BookingCard';
import { BookingDetailsModal } from '../src/apps/student/components/BookingDetailsModal';
import { PublicSearchProviderResult, Booking } from '../src/types';

describe('Student Journey Batch 2 - UI/UX Pro Max Contracts', () => {
  const baseProviderResult: PublicSearchProviderResult = {
    providerId: 'prov-1',
    displayName: 'Carlos Silva Instrutor',
    providerType: 'INSTRUCTOR',
    verificationBadge: 'Verificado pela plataforma',
    isVerified: true,
    ratingAverage: 4.9,
    ratingCount: 28,
    ratingSource: 'REAL',
    approximateDistanceKm: 1.5,
    roundedDistanceMeters: 1500,
    formattedDistance: '1,5 km',
    neighborhood: 'Pinheiros',
    city: 'São Paulo',
    categories: ['B'],
    transmissions: ['MANUAL'],
    startingPriceInCents: 12000,
    normalizedPricePerFiftyMinInCents: 12000,
    publicOfferings: [
      {
        id: 'off-1',
        vehicleId: 'veh-1',
        vehicleTitle: 'VW Polo 1.0 Manual',
        vehicleType: 'CAR',
        category: 'B',
        transmission: 'MANUAL',
        photos: [],
        durationMinutes: 50,
        priceInCents: 12000,
      },
    ],
    availableSlotCount: 8,
    publicMapLocation: {
      type: 'SERVICE_AREA',
      label: 'Pinheiros, São Paulo',
    },
    rankingScore: 0.95,
  };

  it('ProviderResultCard: shows direct price when only single offering is available', () => {
    const markup = renderToStaticMarkup(
      <ProviderResultCard result={baseProviderResult} onSelect={vi.fn()} />
    );

    expect(markup).toContain('Valor por aula');
    expect(markup).not.toContain('A partir de');
    expect(markup).toContain('R$ 120,00');
    expect(markup).toContain('· 50 min');
    expect(markup).toContain('Instrutor autônomo');
    expect(markup).toContain('Verificado');
    expect(markup).toContain('Cat. B');
    expect(markup).toContain('Agendar');
  });

  it('ProviderResultCard: shows "A partir de" when multiple offerings exist and supports Category A', () => {
    const multiOfferingResult: PublicSearchProviderResult = {
      ...baseProviderResult,
      providerType: 'DRIVING_SCHOOL',
      displayName: 'Autoescola Paulista',
      isVerified: false,
      categories: ['A', 'B'],
      publicOfferings: [
        {
          id: 'off-1',
          vehicleId: 'veh-1',
          vehicleTitle: 'Honda CG 160',
          vehicleType: 'MOTORCYCLE',
          category: 'A',
          transmission: 'MANUAL',
          photos: [],
          durationMinutes: 50,
          priceInCents: 9000,
        },
        {
          id: 'off-2',
          vehicleId: 'veh-2',
          vehicleTitle: 'VW Gol 1.0',
          vehicleType: 'CAR',
          category: 'B',
          transmission: 'MANUAL',
          photos: [],
          durationMinutes: 50,
          priceInCents: 11000,
        },
      ],
      startingPriceInCents: 9000,
    };

    const markup = renderToStaticMarkup(
      <ProviderResultCard result={multiOfferingResult} onSelect={vi.fn()} onViewProfile={vi.fn()} />
    );

    expect(markup).toContain('A partir de');
    expect(markup).toContain('R$ 90,00');
    expect(markup).toContain('Autoescola / CFC');
    expect(markup).not.toContain('Verificado');
    expect(markup).toContain('Cat. A');
    expect(markup).toContain('Perfil');
    expect(markup).toContain('Agendar');
  });

  it('ProviderResultCard: shows "Novo na MAZZI" when ratingCount is 0', () => {
    const newProvider: PublicSearchProviderResult = {
      ...baseProviderResult,
      ratingCount: 0,
      ratingAverage: 0,
      isVerified: false,
    };

    const markup = renderToStaticMarkup(
      <ProviderResultCard result={newProvider} onSelect={vi.fn()} />
    );

    expect(markup).toContain('Novo na MAZZI');
    expect(markup).not.toContain('Verificado');
  });

  it('ProviderPublicProfileModal: renders offerings dynamically for both Category A and B', () => {
    const multiCatResult: PublicSearchProviderResult = {
      ...baseProviderResult,
      categories: ['A', 'B'],
      publicOfferings: [
        {
          id: 'off-a',
          vehicleId: 'veh-a',
          vehicleTitle: 'Yamaha Fazer 250',
          vehicleType: 'MOTORCYCLE',
          category: 'A',
          transmission: 'MANUAL',
          photos: [],
          durationMinutes: 50,
          priceInCents: 9500,
        },
        {
          id: 'off-b',
          vehicleId: 'veh-b',
          vehicleTitle: 'Toyota Yaris Automático',
          vehicleType: 'CAR',
          category: 'B',
          transmission: 'AUTOMATIC',
          photos: [],
          durationMinutes: 50,
          priceInCents: 13500,
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <ProviderPublicProfileModal
        isOpen={true}
        onClose={vi.fn()}
        result={multiCatResult}
        onSelectSlotToBook={vi.fn()}
      />
    );

    expect(markup).toContain('Yamaha Fazer 250');
    expect(markup).toContain('Toyota Yaris Automático');
    expect(markup).toContain('Cat. A');
    expect(markup).toContain('Cat. B');
    expect(markup).toContain('Automático · Categoria B · 50 min');
    expect(markup).toContain('Agendar aula');
    expect(markup).toContain('lucide-calendar-plus');
  });

  it('BookingCard & BookingDetailsModal: preserves callbacks, tokens and permissions properly', () => {
    const mockBooking: Booking = {
      id: 'bk-1',
      studentId: 'std-1',
      providerId: 'prov-1',
      providerName: 'Autoescola Modelo',
      instructorId: 'inst-1',
      instructorName: 'Roberto Alves',
      vehicleId: 'veh-1',
      vehicleName: 'Hyundai HB20',
      offeringId: 'off-1',
      category: 'B',
      scheduledDate: '2026-08-25',
      startTime: '14:00',
      endTime: '14:50',
      scheduledStartAt: '2026-08-25T14:00:00Z',
      scheduledEndAt: '2026-08-25T14:50:00Z',
      status: 'CONFIRMED',
      snapshot: {
        providerId: 'prov-1',
        providerName: 'Autoescola Modelo',
        providerType: 'DRIVING_SCHOOL',
        instructorId: 'inst-1',
        instructorName: 'Roberto Alves',
        vehicleId: 'veh-1',
        vehicleName: 'Hyundai HB20',
        transmission: 'MANUAL',
        category: 'B',
        durationMinutes: 50,
        priceInCents: 10000,
        platformFeeInCents: 1000,
        totalInCents: 11000,
        meetingPoint: 'Rua Augusta, 1000',
      },
      meetingPoint: 'Rua Augusta, 1000',
      priceInCents: 10000,
      platformFeeInCents: 1000,
      totalInCents: 11000,
      createdAt: '2026-08-20T10:00:00Z',
    };

    const cardMarkup = renderToStaticMarkup(
      <BookingCard
        booking={mockBooking}
        variant="student"
        onOpenChat={vi.fn()}
        onViewDetails={vi.fn()}
      />
    );

    expect(cardMarkup).toContain('Roberto Alves');
    expect(cardMarkup).toContain('Hyundai HB20');
    expect(cardMarkup).toContain('Manual');
    expect(cardMarkup).toContain('Rua Augusta, 1000');
    expect(cardMarkup).toContain('R$ 110,00');
    expect(cardMarkup).not.toContain('Chat');
    expect(cardMarkup).toContain('Detalhes');

    const detailsMarkup = renderToStaticMarkup(
      <BookingDetailsModal
        isOpen={true}
        onClose={vi.fn()}
        booking={mockBooking}
        onOpenChat={vi.fn()}
      />
    );

    expect(detailsMarkup).toContain('Detalhes da Reserva');
    expect(detailsMarkup).toContain('Roberto Alves');
    expect(detailsMarkup).toContain('Autoescola Modelo');
    expect(detailsMarkup).toContain('Hyundai HB20');
    expect(detailsMarkup).toContain('R$ 100,00');
    expect(detailsMarkup).toContain('R$ 10,00');
    expect(detailsMarkup).toContain('R$ 110,00');
    expect(detailsMarkup).toContain('Abrir Chat');
  });
});
