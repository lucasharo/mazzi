import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260910141017_fix_public_search_agenda_source.sql'),
  'utf8',
);

describe('agenda and Aula Agora marketplace isolation', () => {
  it('limits the public search and date availability gate to agenda offerings', () => {
    expect(migration).toContain("WHERE o.source = 'AGENDA'");
    expect(migration).toContain("AND so_avail.source = 'AGENDA'");
    expect(migration).not.toContain("WHERE o.source <> 'AULA_AGORA'");
  });
});
