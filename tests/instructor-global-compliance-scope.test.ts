import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/20260821210000_instructor_global_compliance_scope.sql');
const lifecyclePath = path.join(root, 'supabase/migrations/20260821200000_school_instructor_membership_lifecycle.sql');
const lifecycleTestPath = path.join(root, 'tests/school-instructor-membership-lifecycle.test.ts');

const read = (filePath: string) => fs.readFileSync(filePath, 'utf8');
const normalized = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();

describe('TASK-072 — instructor global compliance scope', () => {
  it('creates the new forward-only migration without changing prior migrations', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(fs.existsSync(lifecyclePath)).toBe(true);
    expect(fs.existsSync(lifecycleTestPath)).toBe(true);
  });

  it('defines exactly the four document scopes', () => {
    const sql = read(migrationPath);
    expect(sql.match(/CREATE TYPE public\.compliance_document_scope AS ENUM \(([\s\S]*?)\);/i)?.[1])
      .toMatch(/'USER_GLOBAL'[\s\S]*'PROVIDER'[\s\S]*'MEMBERSHIP'[\s\S]*'VEHICLE'/i);
    expect(sql.match(/CREATE TYPE public\.compliance_document_scope AS ENUM \(([\s\S]*?)\);/i)?.[1]
      ?.match(/'[^']+'/g)).toHaveLength(4);
  });

  it('adds scoped document columns and makes provider_id nullable', () => {
    const sql = normalized(read(migrationPath));
    expect(sql).toContain('alter column provider_id drop not null');
    expect(sql).toContain('add column scope public.compliance_document_scope');
    expect(sql).toContain('add column membership_id uuid null references public.driving_school_staff(id)');
    expect(sql).toContain('alter column scope set not null');
  });

  it('uses conservative historical backfill', () => {
    const sql = normalized(read(migrationPath));
    expect(sql).toContain("when vehicle_id is not null then 'vehicle'::public.compliance_document_scope");
    expect(sql).toContain("else 'provider'::public.compliance_document_scope");
    expect(sql).not.toContain("update public.compliance_documents set scope = 'user_global'");
  });

  it('enforces the four scope shapes and prevents cross-scope ownership', () => {
    const sql = normalized(read(migrationPath));
    for (const phrase of [
      "scope = 'user_global'",
      "user_id is not null",
      "provider_id is null",
      "membership_id is null",
      "vehicle_id is null",
      "scope = 'provider'",
      "provider_id is not null",
      "scope = 'membership'",
      "scope = 'vehicle'",
    ]) expect(sql).toContain(phrase);
    expect(sql).toContain('membership_document_user_mismatch');
    expect(sql).toContain('v_membership_user_id is distinct from new.user_id');
  });

  it('keeps membership history non-cascading and avoids a global document uniqueness constraint', () => {
    const sql = normalized(read(migrationPath));
    expect(sql).toContain('references public.driving_school_staff(id)');
    expect(sql).not.toContain('references public.driving_school_staff(id) on delete cascade');
    expect(sql).not.toMatch(/unique\s*\([^)]*user_id[^)]*document_type[^)]*\)/i);
  });

  it('adds nullable requirement scope with only unambiguous classifications', () => {
    const sql = normalized(read(migrationPath));
    expect(sql).toContain('alter table public.compliance_requirements add column scope public.compliance_document_scope null');
    expect(sql).toContain("'cnh_ear'");
    expect(sql).toContain("'company_registration'");
    expect(sql).not.toContain("'credential_historical'");
    expect(sql).not.toContain("'mazzi_terms_acceptance'");
  });

  it('does not alter RLS, add broad policies, grant anon, or introduce activation/booking changes', () => {
    const sql = normalized(read(migrationPath));
    expect(sql).not.toContain('create policy');
    expect(sql).not.toContain('drop policy');
    expect(sql).not.toContain('grant ');
    expect(sql).not.toContain('activate_school_instructor_membership');
    expect(sql).not.toContain('service_offerings');
    expect(sql).not.toContain('bookings');
    expect(sql).not.toContain('quotes');
    expect(sql).not.toContain('search_providers_public');
  });

  it('preserves TASK-069/070 migration and test byte hashes', () => {
    expect(crypto.createHash('sha256').update(read(lifecyclePath)).digest('hex').toUpperCase())
      .toBe('425C9340BEC400FE20CDE2A51BEE08F858943C9241295CCC6644CD700BD1676D');
    expect(crypto.createHash('sha256').update(read(lifecycleTestPath)).digest('hex').toUpperCase())
      .toBe('C940AB473F84EC5353627D2D1F517A6724FD9D1A1324BF752D3EA1E8924E7BCE');
  });
});
