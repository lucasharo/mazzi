import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getNotificationPreferenceDefinitions } from '../src/lib/notification-preferences';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260906000000_task_092_notification_preferences.sql'), 'utf8');
const dispatchMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260908190000_notification_catalog_and_dispatch.sql'), 'utf8');
const dbService = readFileSync(resolve(process.cwd(), 'src/lib/db-service.ts'), 'utf8');
const component = readFileSync(resolve(process.cwd(), 'src/components/notifications/NotificationPreferences.tsx'), 'utf8');
const notificationsPanel = readFileSync(resolve(process.cwd(), 'src/components/notifications/NotificationsPanel.tsx'), 'utf8');
const settingsPanel = readFileSync(resolve(process.cwd(), 'src/components/settings/SettingsPanel.tsx'), 'utf8');
const studentApp = readFileSync(resolve(process.cwd(), 'src/apps/student/StudentApp.tsx'), 'utf8');
const providerProfile = readFileSync(resolve(process.cwd(), 'src/apps/provider/components/ProviderProfileTab.tsx'), 'utf8');

describe('Notification preferences contract', () => {
  it('lists the canonical notification types by application context', () => {
    const studentTypes = getNotificationPreferenceDefinitions('STUDENT').map((item) => item.type);
    const proTypes = getNotificationPreferenceDefinitions('PRO').map((item) => item.type);

    expect(studentTypes).toContain('PROVIDER_ON_THE_WAY');
    expect(studentTypes).toContain('REVIEW_AVAILABLE');
    expect(studentTypes).toContain('LESSON_STARTED');
    expect(studentTypes).toContain('LESSON_COMPLETED');
    expect(studentTypes).not.toContain('PAYOUT_PAID');
    expect(proTypes).toContain('INSTANT_LESSON_OFFER');
    expect(proTypes).toContain('CONTESTATION_UPDATED');
    expect(proTypes).toContain('COMPLIANCE_PENDING');
    expect(proTypes).toContain('PAYOUT_FAILED');
    expect(proTypes).not.toContain('LESSON_STARTED');
    expect(proTypes).not.toContain('LESSON_COMPLETED');
    expect(proTypes).not.toContain('REVIEW_RECEIVED');
    expect(proTypes).not.toContain('PROVIDER_ON_THE_WAY');
    expect(new Set([...studentTypes, ...proTypes]).size).toBe(15);
  });

  it('keeps the frontend persistence contract behind the db service', () => {
    expect(dbService).toContain("rpc('get_my_notification_preferences')");
    expect(dbService).toContain("rpc('set_my_notification_preference'");
    expect(component).toContain('dbService.getMyNotificationPreferences()');
    expect(component).toContain('dbService.setMyNotificationPreference(type, enabled)');
    expect(component).toContain('setPreferences((current) => ({ ...current, [type]: previous }));');
  });

  it('opens preferences from the notifications center instead of embedding them in profiles', () => {
    expect(settingsPanel).toContain('>Configurações</h2>');
    expect(settingsPanel).toContain('<NotificationPreferences appContext={appContext} showHeading={false} />');
    expect(settingsPanel).toContain('<PushNotificationOptIn appContext={appContext} userId={userId} />');
    expect(notificationsPanel).toContain('dbService.getMyNotifications(appContext)');
    expect(notificationsPanel).not.toContain('<NotificationPreferences');
    expect(studentApp).toContain('<NotificationCenterLink onOpen={() => setIsSettingsOpen(true)} />');
    expect(studentApp).toContain('<NotificationsPanel appContext="STUDENT"');
    expect(providerProfile).toContain('<NotificationCenterLink onOpen={onOpenNotifications} />');
    expect(studentApp).toContain('title="Configurações"');
    expect(providerProfile).not.toContain('<NotificationPreferences appContext="PRO" />');
    expect(studentApp).not.toContain('<NotificationPreferences appContext="STUDENT" />');
  });

  it('protects preferences and filters only future disabled notifications in the database', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.user_notification_preferences');
    expect(migration).toContain('ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('CREATE POLICY user_notification_preferences_no_direct_client_access');
    expect(migration).toContain('WHERE p.user_id = (SELECT auth.uid())');
    expect(migration).toContain("RAISE EXCEPTION 'AUTH_REQUIRED'");
    expect(migration).toContain("RAISE EXCEPTION 'NOTIFICATION_TYPE_INVALID'");
    expect(migration).toContain('REVOKE ALL ON TABLE public.user_notification_preferences FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.get_my_notification_preferences() TO authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.set_my_notification_preference(TEXT, BOOLEAN) TO authenticated');
    expect(migration).toContain('CREATE TRIGGER filter_disabled_notifications_before_insert');
    expect(migration).toContain('RETURN NULL');
    expect(migration).not.toContain('DELETE FROM public.notifications');
  });

  it('keeps backend dispatch aligned with the visible catalog', () => {
    expect(dispatchMigration).toContain('notify_booking_dispute_change');
    expect(dispatchMigration).toContain('notify_booking_dispute_evidence');
    expect(dispatchMigration).toContain('notify_provider_payout_change');
    expect(dispatchMigration).toContain('notify_provider_compliance_pending');
    expect(dispatchMigration).toContain("NEW.type = 'REVIEW_RECEIVED'");
    expect(dispatchMigration).toContain("p_type NOT IN ('LESSON_STARTED', 'LESSON_COMPLETED')");
    expect(dispatchMigration).toContain('NOT (app_context = \'PRO\' AND type = \'REVIEW_RECEIVED\')');
  });
});
