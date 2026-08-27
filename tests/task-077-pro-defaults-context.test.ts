import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isValidCnpj } from '../src/lib/input-masks';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260826050000_task_077_pro_defaults_and_notification_context.sql'),
  'utf8',
);
const dbService = fs.readFileSync(path.join(process.cwd(), 'src/lib/db-service.ts'), 'utf8');
const studentApp = fs.readFileSync(path.join(process.cwd(), 'src/apps/student/StudentApp.tsx'), 'utf8');
const providerApp = fs.readFileSync(path.join(process.cwd(), 'src/apps/provider/ProviderApp.tsx'), 'utf8');
const adminApp = fs.readFileSync(path.join(process.cwd(), 'src/apps/admin/AdminApp.tsx'), 'utf8');
const appLogin = fs.readFileSync(path.join(process.cwd(), 'src/components/auth/AppLogin.tsx'), 'utf8');

describe('TASK-077 PRO defaults and contextual notifications', () => {
  it('accepts only a valid normalized CNPJ before the server remains authoritative', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
    expect(appLogin).toContain("if (lower.includes('cnpj_invalid'))");
    expect(appLogin).toContain("return 'Este CNPJ já está cadastrado no MAZZI.'");
  });

  it('creates weekday defaults only as part of a newly created instructor provider', () => {
    expect(migration).toContain('v_provider_created BOOLEAN := FALSE');
    expect(migration).toContain('IF v_provider_created THEN');
    expect(migration).toContain('FROM generate_series(1, 5) AS weekday');
    expect(migration).toContain("TIME '08:00', TIME '18:00', 'America/Sao_Paulo', TRUE");
    expect(migration).toContain('provider_schedule_bootstrap');
    expect(migration).not.toContain('generate_series(0, 6)');
  });

  it('keeps notification list and unread counts isolated by explicit app context', () => {
    expect(migration).toContain("app_context IN ('STUDENT', 'PRO', 'ADMIN')");
    expect(migration).toContain('resolve_notification_app_context');
    expect(dbService).toContain(".eq('app_context', appContext)");
    expect(dbService).toContain('markAllNotificationsAsRead(appContext');
    expect(studentApp).toContain('<NotificationsPanel appContext="STUDENT" />');
    expect(providerApp).toContain('<NotificationsPanel appContext="PRO" />');
    expect(adminApp).not.toContain('<NotificationsPanel appContext="ADMIN" />');
  });

  it('uses canonical in-screen feedback rather than native vehicle/offering alerts', () => {
    expect(providerApp).toContain("setVehicleError(mapFriendlyErrorMessage(err, 'Ação de ativação do veículo não permitida.'))");
    expect(providerApp).toContain("setOfferingError(mapFriendlyErrorMessage(err, 'Ação de ativação da oferta não permitida.'))");
    expect(providerApp).not.toContain("alert(mapFriendlyErrorMessage(err, 'Ação de ativação do veículo não permitida.'))");
  });
});
