import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/apps/student/StudentApp.tsx', 'utf8');

describe('Student bottom navigation', () => {
  it('renders the active destination as a filled icon-only item in a 3-tab layout', () => {
    expect(source).toContain("aria-current={isActive ? 'page' : undefined}");
    expect(source).toContain('bg-[var(--mazzi-yellow)]');
    expect(source).toContain('{!isActive && <span');
    expect(source).toContain('grid-cols-3');
    expect(source).not.toContain("{ id: 'messages'");
  });
});
