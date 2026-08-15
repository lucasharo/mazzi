import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('PostGIS & Database Schema Search Contract (Sprint 07 Audit)', () => {
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260814000008_search_postgis.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  it('verifies PostGIS extension is requested', () => {
    expect(migrationSql).toContain('CREATE EXTENSION IF NOT EXISTS postgis');
  });

  it('verifies dedicated GEOGRAPHY(Point, 4326) column and GiST index', () => {
    expect(migrationSql).toContain('GEOGRAPHY(Point, 4326)');
    expect(migrationSql).toContain('idx_providers_location_geog_gist');
    expect(migrationSql).toContain('USING gist (location_geography)');
  });

  it('verifies search_providers_public RPC function uses ST_DWithin and ST_Distance on GEOGRAPHY', () => {
    expect(migrationSql).toContain('ST_DWithin(p.location_geography');
    expect(migrationSql).toContain('ST_Distance(p.location_geography');
    expect(migrationSql).toContain('ST_MakePoint(p_user_lng, p_user_lat)');
  });

  it('verifies RPC security properties: SECURITY INVOKER and search_path isolation', () => {
    expect(migrationSql).toContain('SECURITY INVOKER');
    expect(migrationSql).toContain('SET search_path = public, pg_temp');
  });

  it('verifies RPC grants permissions to anon and authenticated roles', () => {
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.search_providers_public TO anon, authenticated');
  });

  it('verifies explicit sanitized SELECT output without wildcard SELECT * or private fields', () => {
    expect(migrationSql).not.toContain('SELECT *');
    expect(migrationSql).not.toContain('p.document_number');
    expect(migrationSql).not.toContain('p.phone');
    expect(migrationSql).not.toContain('p.email');
    expect(migrationSql).not.toContain('p.address');
    expect(migrationSql).not.toContain('p.latitude AS private_latitude');
  });

  it('verifies RPC returns sanitized distance (rounded_distance_meters & distance_display) to prevent triangulation', () => {
    expect(migrationSql).toContain('rounded_distance_meters INT');
    expect(migrationSql).toContain('distance_display TEXT');
    expect(migrationSql).not.toContain('distance_meters DOUBLE PRECISION');
  });

  it('verifies parameterized inputs against SQL injection vulnerability', () => {
    expect(migrationSql).toContain('p_user_lat DOUBLE PRECISION');
    expect(migrationSql).toContain('p_user_lng DOUBLE PRECISION');
    expect(migrationSql).toContain('p_radius_meters DOUBLE PRECISION');
    expect(migrationSql).toContain('p_category TEXT');
    expect(migrationSql).toContain('p_provider_type TEXT');
  });
});
