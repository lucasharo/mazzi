import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const student = readFileSync(join(root, 'src/apps/student/StudentApp.tsx'), 'utf8');
const header = readFileSync(join(root, 'src/components/search/SearchHeader.tsx'), 'utf8');

describe('Student search layout hierarchy', () => {
  it('separates date, quick filters and results without changing search handlers', () => {
    expect(student).toContain('student-date-filter-title');
    expect(student).toContain('student-quick-filters-title');
    expect(student).toContain('student-results-title');
    expect(student).toContain('getBusinessDateOnly()');
    expect(student).toContain('getBusinessDateOnly(1)');
    expect(student).toContain('setIsFilterDrawerOpen(true)');
    expect(student).toContain('setSearchViewMode(\'list\')');
    expect(student).toContain('setSearchViewMode(\'map\')');
    expect(student).not.toContain('>Carro<');
  });

  it('keeps Category B as the location badge and removes the redundant car chip', () => {
    expect(header).toContain('Cat. B');
    expect(header).not.toContain('>Carro<');
    expect(header).toContain('slice(-2)');
  });
});
