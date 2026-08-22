import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../src/components/ui/StatusBadge';

describe('global compliance status badge', () => {
  it.each([
    ['OFFICIALLY_VALIDATED', 'Regulamentado', 'bg-emerald-50'],
    ['REQUIRES_REGULATORY_VALIDATION', 'Em análise', 'bg-amber-50'],
    ['SUPERSEDED', 'Pendente', 'bg-orange-50'],
    ['INACTIVE', 'Não aprovado', 'bg-rose-50'],
    ['APPROVED', 'Aprovado', 'bg-emerald-50'],
    ['UNDER_REVIEW', 'Em análise', 'bg-blue-50'],
    ['PENDING', 'Pendente', 'bg-orange-50'],
    ['REJECTED', 'Não aprovado', 'bg-rose-50'],
    ['EXPIRED', 'Não aprovado', 'bg-rose-50'],
  ])('maps %s to the shared semantic state', (status, label, color) => {
    const markup = renderToStaticMarkup(
      <StatusBadge status={status} domain="compliance" />,
    );

    expect(markup).toContain(label);
    expect(markup).toContain(color);
  });

  it('keeps blocked and rejected operational states distinct', () => {
    expect(renderToStaticMarkup(<StatusBadge status="BLOCKED" />)).toContain('Bloqueado');
    expect(renderToStaticMarkup(<StatusBadge status="REJECTED" />)).toContain('Rejeitado');
  });
});
