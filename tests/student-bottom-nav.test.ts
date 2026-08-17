import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/apps/student/StudentApp.tsx', 'utf8');

describe('Student bottom navigation', () => {
  it('renders the active destination as a filled icon-only item', () => {
    expect(source).toContain("aria-current={isActive ? 'page' : undefined}");
    expect(source).toContain("isActive ? 'bg-[var(--mazzi-yellow)]");
    expect(source).toContain('{!isActive && <span');
  });
});
