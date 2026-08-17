import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getBusinessDateOnly } from '../src/lib/date-format';

const root = process.cwd();
const student = readFileSync(join(root, 'src/apps/student/StudentApp.tsx'), 'utf8');
const db = readFileSync(join(root, 'src/lib/db-service.ts'), 'utf8');
const profile = readFileSync(join(root, 'src/apps/student/StudentApp.tsx'), 'utf8');
const notifications = readFileSync(join(root, 'src/components/notifications/NotificationsPanel.tsx'), 'utf8');
const checkout = readFileSync(join(root, 'src/apps/student/components/CheckoutModal.tsx'), 'utf8');
const review = readFileSync(join(root, 'src/components/reviews/ReviewModal.tsx'), 'utf8');
const chat = readFileSync(join(root, 'src/components/chat/BookingChatPanel.tsx'), 'utf8');

describe('Student new template phase 5 finalization contracts', () => {
  it('creates business dates safely in America/Sao_Paulo', () => {
    const now = new Date('2026-08-17T02:30:00.000Z');
    expect(getBusinessDateOnly(0, now)).toBe('2026-08-16');
    expect(getBusinessDateOnly(1, now)).toBe('2026-08-17');
  });

  it('sends date to the public search RPC and exposes only B date filters', () => {
    expect(db).toContain('p_date: date ?? null');
    expect(student).toContain('getBusinessDateOnly()');
    expect(student).toContain('getBusinessDateOnly(1)');
    expect(student).toContain('date: undefined');
    expect(student).not.toContain("category: 'A'");
  });

  it('keeps profile editing and avatar flows real with friendly errors', () => {
    expect(profile).toContain('ProfilePhotoPicker');
    expect(profile).toContain('dbService.updateMyProfile');
    expect(profile).toContain('Não foi possível salvar seu perfil.');
    expect(profile).toContain('id="student-profile-email"');
  });

  it('standardizes notification, checkout and review presentation', () => {
    expect(notifications).toContain('getMyNotifications');
    expect(notifications).toContain('formatDateTimeBR');
    expect(notifications).toContain('Não foi possível carregar suas notificações.');
    expect(checkout).toContain('scheduledStartAt');
    expect(checkout).toContain('role="alert"');
    expect(checkout).toContain('formatTimeBR');
    expect(review).toContain('createReviewForBooking');
    expect(review).toContain('aria-label={`${value}');
    expect(review).toContain('Não foi possível enviar sua avaliação.');
  });

  it('positions the initial chat at the latest message while preserving later scroll behavior', () => {
    expect(chat).toContain('initialPositionedRef');
    expect(chat).toContain("behavior: 'auto'");
    expect(chat).toContain('nearBottom');
    expect(chat).toContain("behavior: 'smooth'");
  });
});
