import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/search/FilterDrawer.tsx', 'utf8');

describe('Student filter modal apply and accessibility behavior', () => {
  it('stages filter choices and only updates search from the apply action', () => {
    expect(source).toContain('const [draft, setDraft]');
    expect(source).toContain('const updateDraft');
    expect(source).toContain('onApplyFilters(draft)');
    expect(source).toContain('onClick={handleApply}');
    expect(source).not.toMatch(/onClick=\{\(\) => handleApply\(\{/);
  });

  it('keeps the footer above the mobile navigation and uses the accessible Modal primitive', () => {
    expect(source).toContain('z-[60]');
    expect(source).toContain('Aplicar Filtros');
    expect(source).toContain('shrink-0');
    expect(source).toContain('<Modal id="mazzi-filter-modal" isOpen={isOpen} onClose={onClose} title="Filtros"');
    expect(source).toContain('export const FilterModal = FilterDrawer;');
  });

  it('ensures 44px minimum touch targets and brand yellow selected state on filter chips', () => {
    expect(source).toContain('min-h-11');
    expect(source).toContain('bg-[var(--mazzi-yellow)]');
    expect(source).toContain('text-[var(--mazzi-dark)]');
    expect(source).toContain('onClick={handleReset}');
    expect(source).toContain('Limpar');
  });
});
