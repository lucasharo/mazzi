import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const migration = read('supabase/migrations/20260906002000_task_093_instant_platform_config.sql');
const dispatchFix = read('supabase/migrations/20260906003000_task_093_fix_instant_request_dispatch_alias.sql');
const providerPanel = read('src/apps/provider/components/ProviderInstantLessonPanel.tsx');
const providerApp = read('src/apps/provider/ProviderApp.tsx');
const admin = read('src/apps/admin/AdminComponents.tsx');
const dbService = read('src/lib/db-service.ts');

describe('Aula Agora platform configuration', () => {
  it('uses admin-controlled labels and removes manual vehicle saving', () => {
    expect(providerPanel).toContain('Deslocamento máximo {platformConfig.maxEtaMinutes} min');
    expect(providerPanel).toContain('A oferta expira em {platformConfig.offerExpirationSeconds}s');
    expect(providerPanel).not.toContain('ETA máximo 30 min');
    expect(providerPanel).not.toContain('>Salvar</Button>');
    expect(providerPanel).toContain('disabled={draft.enabled || savingId === configuration.id}');
    expect(providerPanel).toContain('onBlur={() => void save(configuration)}');
    expect(providerPanel).toContain('void save(configuration, event.target.checked)');
  });

  it('exposes the values in Admin and loads them into the PRO panel', () => {
    expect(admin).toContain('Tempo máximo de deslocamento (minutos)');
    expect(admin).toContain('Validade da oferta (segundos)');
    expect(dbService).toContain("rpc('get_instant_lesson_platform_config')");
    expect(dbService).toContain("rpc('update_admin_instant_lesson_config'");
    expect(providerApp).toContain('dbService.getInstantLessonPlatformConfig()');
    expect(providerApp).toContain('platformConfig={instantPlatformConfig}');
    expect(providerApp).not.toContain('<InstantConductPanel />');
  });

  it('keeps defaults, authorization, audit and matching expiration server-side', () => {
    expect(migration).toContain("'instant_lesson_settings'");
    expect(migration).toContain('current_user_has_permission');
    expect(migration).toContain("'PLATFORM_CONFIG_UPDATED'");
    expect(migration).toContain('e.eta_minutes <= v_max_eta_minutes');
    expect(migration).toContain('e.eta<=v_max_eta_minutes');
    expect(migration).toContain('MAKE_INTERVAL(secs=>v_offer_expiration_seconds)');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.get_instant_lesson_platform_config() TO authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.update_admin_instant_lesson_config(INTEGER, INTEGER) TO authenticated');
  });

  it('keeps request creation compatible with the configurable dispatch', () => {
    expect(dispatchFix).toContain('v_candidate RECORD');
    expect(dispatchFix).toContain('FOR v_candidate IN');
    expect(dispatchFix).not.toContain('FOR c IN');
    expect(dispatchFix).not.toContain('SELECT c.*');
    expect(dispatchFix).toContain('MAKE_INTERVAL(secs=>v_offer_expiration_seconds)');
  });
});
