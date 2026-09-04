// @vitest-environment happy-dom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { InstantLessonOfferCard } from '../src/components/instant/InstantLessonOfferCard';
import { InstantLessonPriceSelector } from '../src/components/instant/InstantLessonPriceSelector';

describe('Aula Agora shared UI', () => {
  it('renders price choices as an accessible radio group without hidden price changes', () => {
    const markup = renderToStaticMarkup(
      <InstantLessonPriceSelector
        options={[{ maxPriceInCents: 10000, eligibleProviderCount: 2 }, { maxPriceInCents: null, eligibleProviderCount: 4 }]}
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('Sem limite');
    expect(markup).toContain('R$ 100,00');
    expect(markup).not.toContain('mais barato');
  });

  it('renders an offer with ETA, countdown and explicit actions', () => {
    const markup = renderToStaticMarkup(
      <InstantLessonOfferCard
        offer={{
          id: 'offer-1', requestId: 'request-1', providerId: 'provider-1', offeringId: 'offering-1',
          instructorId: 'instructor-1', vehicleId: 'vehicle-1', category: 'B', transmission: 'MANUAL',
          durationMinutes: 50, offeredPriceInCents: 10000, distanceMeters: 1200, etaMinutes: 8,
          status: 'PENDING', expiresAt: new Date(Date.now() + 15000).toISOString(), createdAt: new Date().toISOString(),
        }}
        secondsLeft={15}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />,
    );
    expect(markup).toContain('8 min');
    expect(markup).toContain('15s');
    expect(markup).toContain('Aceitar');
    expect(markup).toContain('Recusar');
  });
});
