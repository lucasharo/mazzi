import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const showcase = readFileSync(
  join(process.cwd(), 'src/apps/design-system/DesignSystemShowcase.tsx'),
  'utf8',
);

const renderedStudentComponents = [
  'AppHomeHeader',
  'SearchHeader',
  'ProviderResultCard',
  'MapView',
  'AppPageHeader',
  'BookingCard',
  'ProfilePhotoPicker',
  'AppBottomNav',
  'FilterDrawer',
  'ProviderPublicProfileModal',
  'SlotSelectorModal',
  'BookingDetailsModal',
] as const;

const connectedStudentFlows = [
  'SlotSelectorModal',
  'CheckoutModal',
  'BookingChatPanel',
  'NotificationsPanel',
  'ReviewModal',
] as const;

describe('Design System parity with the Student app', () => {
  it('publishes the Student app as an executable visual reference', () => {
    expect(showcase).toContain("id: 'student-reference'");
    expect(showcase).toContain('data-section="student-reference"');
    expect(showcase).toContain('Fonte de verdade visual');
  });

  it('renders the reusable components used by the Student surfaces', () => {
    const missing = renderedStudentComponents.filter((component) => (
      !new RegExp(`<${component}\\b`).test(showcase)
    ));

    expect(missing).toEqual([]);
  });

  it('documents the connected Student flows without duplicating them', () => {
    const missing = connectedStudentFlows.filter((component) => !showcase.includes(component));

    expect(missing).toEqual([]);
  });

  it('runs the real Student scheduling selector with isolated preview data', () => {
    expect(showcase).toContain('previewSlots={DESIGN_SYSTEM_PREVIEW_SLOTS}');
    expect(showcase).toContain('Ver dias e horários');
    expect(showcase).toContain('data-section="booking-schedule"');
  });

  it('uses the same lesson-tab patterns as Student and PRO', () => {
    expect(showcase).toContain('aria-label="Aulas" className="grid grid-cols-2 gap-1 rounded-2xl');
    expect(showcase).toContain('aria-label="Filtros de aulas" className="mazzi-segmented overflow-x-auto"');
  });

  it('does not publish the obsolete yellow header-icon gallery', () => {
    expect(showcase).not.toContain('Botões Ícone de Cabeçalho (48px x 48px)');
    expect(showcase).not.toContain('mazzi-avatar grid h-12 w-12 min-h-[48px]');
  });
});
