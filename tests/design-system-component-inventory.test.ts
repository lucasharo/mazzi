import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const showcase = readFileSync(
  join(process.cwd(), 'src/apps/design-system/DesignSystemShowcase.tsx'),
  'utf8',
);

const visualComponents = [
  'AppBottomNav', 'AppHomeHeader', 'AppPageHeader', 'Badge', 'BookingCard',
  'Button', 'ButtonBase', 'PrimaryButton', 'SecondaryButton', 'EmptyState',
  'ErrorState', 'IconButton', 'Input', 'ListEmptyState', 'LoadingScreen',
  'Modal', 'ObjectEmptyState', 'OtpInput', 'Rating', 'Select', 'StatusBadge',
] as const;

const componentsNotUsedByStudentOrPro = [
  'Avatar', 'BottomSheet', 'Calendar', 'Card', 'Checkbox',
  'FloatingActionFooter', 'ModalActionFooter', 'Price', 'ProviderCard',
  'Skeleton', 'Tabs', 'TimePicker', 'ToastContainer', 'VehicleCard',
] as const;

describe('Design System component inventory', () => {
  it('renders every shared visual component in the executable catalog', () => {
    const missing = visualComponents.filter((component) => (
      !new RegExp(`<${component}\\b`).test(showcase)
    ));

    expect(missing).toEqual([]);
  });

  it('publishes the complete inventory section', () => {
    expect(showcase).toContain("id: 'component-inventory'");
    expect(showcase).toContain('21 componentes públicos');
    expect(showcase).toContain('data-section="component-inventory"');
  });

  it('excludes components that are not reached by Student or Instructor entrypoints', () => {
    for (const component of componentsNotUsedByStudentOrPro) {
      expect(showcase).not.toContain(`components/ui/${component}`);
      expect(new RegExp(`<${component}\\b`).test(showcase)).toBe(false);
    }
    expect(showcase).not.toContain("id: 'bottom-actions'");
    expect(showcase).toContain("id: 'booking'");
    expect(showcase).toContain('data-section="booking-schedule"');
  });
});
