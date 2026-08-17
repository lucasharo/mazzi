import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const student = readFileSync(join(root, 'src/apps/student/StudentApp.tsx'), 'utf8');
const header = readFileSync(join(root, 'src/components/search/SearchHeader.tsx'), 'utf8');
const drawer = readFileSync(join(root, 'src/components/search/FilterDrawer.tsx'), 'utf8');

describe('Student search layout hierarchy', () => {
  it('separates date, quick filters and results without changing search handlers', () => {
    expect(student).toContain('student-results-title');
    expect(student).toContain('setSearchViewMode(\'list\')');
    expect(student).toContain('setSearchViewMode(\'map\')');
    expect(student).toContain('onOpenFilters={() => setIsFilterDrawerOpen(true)}');
    expect(student).not.toContain('>Carro<');
  });

  it('keeps Category B as the location badge and removes the redundant car chip', () => {
    expect(header).not.toContain('>Carro<');
    expect(header).not.toContain('Cat. B');
    expect(student).toContain("category: 'B'");
    expect(drawer).toContain('Quando você quer sua aula?');
    expect(drawer).toContain('getBusinessDateOnly()');
    expect(drawer).toContain('getBusinessDateOnly(1)');
    expect(drawer).toContain('Tipo de Câmbio');
    expect(drawer).toContain('Raio Máximo de Busca');
    expect(drawer).toContain('Faixa de Preço Máxima por Aula');
  });
});
