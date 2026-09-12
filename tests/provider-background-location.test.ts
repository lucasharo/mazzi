import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
};
const capacitorConfig = readFileSync('capacitor.config.ts', 'utf8');
const backgroundLocation = readFileSync('src/lib/provider-background-location.ts', 'utf8');
const providerApp = readFileSync('src/apps/provider/ProviderApp.tsx', 'utf8');
const instructorRoot = readFileSync('src/entrypoints/instructor/InstructorRoot.tsx', 'utf8');
const androidStrings = readFileSync('android-pro/app/src/main/res/values/strings.xml', 'utf8');
const androidIcon = readFileSync('android-pro/app/src/main/res/drawable/ic_stat_mazzi_location.xml', 'utf8');

describe('PRO background location contract', () => {
  it('pins the Capacitor 8-compatible plugin and has a dedicated PRO sync command', () => {
    expect(packageJson.dependencies['@capgo/background-geolocation']).toBe('8.4.5');
    expect(packageJson.scripts['cap:sync:android:pro']).toContain('sync-capacitor-pro.mjs');
    expect(capacitorConfig).toContain("process.env.MAZZI_CAPACITOR_TARGET === 'pro'");
    expect(capacitorConfig).toContain("path: isProfessionalTarget ? 'android-pro' : 'android'");
    expect(capacitorConfig).toContain('useLegacyBridge: isProfessionalTarget');
  });

  it('runs a visible Android foreground service with periodic GPS and network fallback', () => {
    expect(backgroundLocation).toContain("backgroundTitle: NOTIFICATION_TITLE");
    expect(backgroundLocation).toContain("backgroundMessage: NOTIFICATION_MESSAGE");
    expect(backgroundLocation).toContain('distanceFilter: 0');
    expect(backgroundLocation).toContain('minIntervalMs: LOCATION_INTERVAL_MS');
    expect(backgroundLocation).toContain('networkFallback: true');
    expect(androidStrings).toContain('Localização da Aula Agora');
    expect(androidStrings).toContain('drawable/ic_stat_mazzi_location');
    expect(androidIcon).toContain('<vector');
    expect(androidIcon).not.toContain('.png');
  });

  it('sends coordinates through native HTTP with the authenticated RLS identity', () => {
    expect(backgroundLocation).toContain("import { CapacitorHttp } from '@capacitor/core'");
    expect(backgroundLocation).toContain('supabase.auth.getSession()');
    expect(backgroundLocation).toContain('data.session.user.id !== instructorId');
    expect(backgroundLocation).toContain('/rest/v1/rpc/upsert_my_instant_location');
    expect(backgroundLocation).toContain('Authorization: `Bearer ${data.session.access_token}`');
    expect(backgroundLocation).toContain('p_provider_id: providerId');
    expect(backgroundLocation).toContain('p_instructor_id: instructorId');
    expect(backgroundLocation).not.toContain('SERVICE_ROLE');
    expect(backgroundLocation).not.toContain('SUPABASE_SECRET');
  });

  it('tracks only the signed-in instructor during the canonical Aula Agora window', () => {
    expect(providerApp).toContain('status.instructorId === user?.id');
    expect(providerApp).toContain('isInstantInstructorAvailabilityActive(ownInstantInstructorStatus)');
    expect(providerApp).toContain('onlineExpiresAt: ownInstantOnlineExpiresAt');
    expect(backgroundLocation).toContain('Date.now() >= expiresAtMs');
    expect(backgroundLocation).toContain('expiresAtMs - Date.now()');
  });

  it('stops on pause, logout, unmount, expiration, authorization loss and signed-out startup', () => {
    expect(providerApp).toContain('if (!online && user?.id === instructorId)');
    expect(providerApp).toContain('await stopProviderBackgroundLocation();');
    expect(providerApp).toContain('void stopProviderBackgroundLocation();');
    expect(backgroundLocation).toContain("error.kind === 'SESSION' || error.kind === 'AUTHORIZATION'");
    expect(instructorRoot).toContain('if (!auth.isLoading && !auth.isAuthenticated)');
    expect(instructorRoot).toContain('void stopProviderBackgroundLocation();');
  });
});
