import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../src/components/ui/Button';

const cancellationUiFiles = [
  '../src/apps/admin/AdminApp.tsx',
  '../src/apps/admin/AdminComponents.tsx',
  '../src/apps/provider/ProviderApp.tsx',
  '../src/apps/provider/components/ProviderBookingDetailsModal.tsx',
  '../src/apps/provider/components/ProviderBookingsTab.tsx',
  '../src/apps/provider/components/ProviderCancellationModal.tsx',
  '../src/apps/provider/components/ProviderManagementTab.tsx',
  '../src/apps/provider/components/ProviderProfileTab.tsx',
  '../src/apps/provider/components/ProviderScheduleTab.tsx',
  '../src/apps/student/StudentApp.tsx',
  '../src/apps/student/components/BookingDetailsModal.tsx',
  '../src/components/profile/ProfilePhotoPicker.tsx',
].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8'));

describe('global cancellation button hierarchy', () => {
  it('renders intermediate cancellation as soft danger and final cancellation as solid danger', () => {
    const soft = renderToStaticMarkup(<Button variant="dangerSoft">Cancelar</Button>);
    const solid = renderToStaticMarkup(<Button variant="danger">Confirmar cancelamento</Button>);

    expect(soft).toContain('bg-rose-50');
    expect(soft).toContain('border-rose-200/80');
    expect(soft).toContain('text-rose-700');
    expect(soft).toContain('lucide-circle-x');
    expect(solid).toContain('bg-rose-600');
    expect(solid).toContain('text-white');
    expect(solid).toContain('lucide-circle-x');
  });

  it('uses dangerSoft for every Cancelar trigger or dismissal in the product apps', () => {
    const cancelButtons = cancellationUiFiles.flatMap((source) =>
      [...source.matchAll(/<Button\b[\s\S]*?<\/Button>/g)]
        .map(([button]) => button)
        .filter((button) => />\s*Cancelar(?: aula)?\s*<\/Button>/.test(button)),
    );

    expect(cancelButtons.length).toBeGreaterThan(0);
    cancelButtons.forEach((button) => expect(button).toContain('variant="dangerSoft"'));
  });

  it('uses solid danger for the final booking cancellation confirmations', () => {
    const finalButtons = cancellationUiFiles.flatMap((source) =>
      [...source.matchAll(/<Button\b[\s\S]*?<\/Button>/g)]
        .map(([button]) => button)
        .filter((button) => /Confirmar (?:C|c)ancelamento/.test(button)),
    );

    expect(finalButtons).toHaveLength(2);
    finalButtons.forEach((button) => expect(button).toContain('variant="danger"'));
  });
});
