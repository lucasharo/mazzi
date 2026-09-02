import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const dispatcher = fs.readFileSync('supabase/functions/dispatch-push-notification/index.ts', 'utf8');
const fcm = fs.readFileSync('supabase/functions/_shared/fcm-http-v1.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260902153159_task_087_fcm_dispatch.sql', 'utf8');
const webhookMigration = fs.readFileSync('supabase/migrations/20260902154300_task_087_fcm_webhook_dispatch.sql', 'utf8');

describe('TASK-087 FCM dispatcher contract', () => {
  it('accepts only the authenticated webhook contract and canonical notification id', () => {
    expect(dispatcher).toContain('x-mazzi-dispatch-secret');
    expect(dispatcher).toContain('body.record?.id || body.notification_id');
    expect(dispatcher).toContain('.from("notifications")');
    expect(dispatcher).toContain('if (!isValidTarget(notification))');
    expect(dispatcher).not.toContain('body.record?.type');
    expect(dispatcher).not.toContain('body.record?.user_id');
  });

  it('retries the canonical lookup across the pg_net transaction-commit race', () => {
    expect(dispatcher).toContain('loadCanonicalNotification');
    expect(dispatcher).toContain('pg_net can start the request before the INSERT transaction commits');
    expect(dispatcher).toContain('await wait(100 * (attempt + 1))');
  });

  it('sends data-only allowlisted fields and binds the Firebase credential to DEV', () => {
    expect(fcm).toContain('FIREBASE_PROJECT_ID');
    expect(fcm).toContain('FCM_PROJECT_MISMATCH');
    expect(fcm).toContain('data: params.data');
    expect(dispatcher).toContain('notificationId: notification.id');
    expect(dispatcher).toContain('entityType: notification.entity_type');
    expect(dispatcher).not.toContain('notification:');
    expect(dispatcher).not.toContain('body: notification');
  });

  it('keeps delivery idempotency, bounded retries, token invalidation and private webhook secret', () => {
    expect(migration).toContain('UNIQUE (notification_id, device_id)');
    expect(migration).toContain('FOR UPDATE SKIP LOCKED');
    expect(migration).toContain('attempt_count < 3');
    expect(migration).toContain('invalidate_push_device');
    expect(migration).toContain("REVOKE ALL ON TABLE public.push_deliveries FROM PUBLIC, anon, authenticated");
    expect(webhookMigration).toContain('vault.decrypted_secrets');
    expect(webhookMigration).toContain('net.http_post');
    expect(webhookMigration).toContain('dispatch-push-notification');
  });
});
