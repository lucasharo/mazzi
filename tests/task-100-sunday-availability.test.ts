import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260906211136_fix_sunday_availability_day_of_week.sql',
);

describe('[STATIC CONTRACT] canonical weekly availability day mapping', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('uses PostgreSQL DOW so Sunday availability stored as 0 is public', () => {
    expect(sql).toContain('a.day_of_week = EXTRACT(DOW FROM days.day_date)::int');
    expect(sql).not.toContain('EXTRACT(ISODOW FROM days.day_date)');
  });
});
