import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/search/FilterDrawer.tsx', 'utf8');

describe('Student filter drawer apply behavior', () => {
  it('stages filter choices and only updates search from the apply action', () => {
    expect(source).toContain('const [draft, setDraft]');
    expect(source).toContain('const updateDraft');
    expect(source).toContain('onApplyFilters(draft)');
    expect(source).toContain('onClick={handleApply}');
    expect(source).not.toMatch(/onClick=\{\(\) => handleApply\(\{/);
  });

  it('keeps the footer above the mobile navigation', () => {
    expect(source).toContain('z-[60]');
    expect(source).toContain('Aplicar Filtros');
    expect(source).toContain('shrink-0');
  });
});
