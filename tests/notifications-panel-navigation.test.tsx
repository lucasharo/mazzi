// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getMyNotifications, markNotificationAsRead, markAllNotificationsAsRead } = vi.hoisted(() => ({
  getMyNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
}));

vi.mock('../src/lib/db-service', () => ({
  dbService: { getMyNotifications, markNotificationAsRead, markAllNotificationsAsRead },
}));

vi.mock('../src/components/notifications/PushNotificationOptIn', () => ({
  PushNotificationOptIn: () => null,
}));

import { NotificationsPanel } from '../src/components/notifications/NotificationsPanel';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NotificationsPanel navigation', () => {
  it('resolves BOOKING_CONFIRMED to the correct Student booking target', async () => {
    const bookingId = '6e4578ed-ef6d-40c6-bb5c-008cdc472b1d';
    getMyNotifications.mockResolvedValue([{
      id: '22222222-2222-4222-8222-222222222222',
      userId: 'student-1',
      type: 'BOOKING_CONFIRMED',
      title: 'Aula confirmada',
      body: 'Sua aula foi confirmada.',
      entityType: 'booking',
      entityId: bookingId,
      isRead: false,
      createdAt: '2026-09-02T20:00:00.000Z',
      appContext: 'STUDENT',
    }]);
    markNotificationAsRead.mockResolvedValue(undefined);
    const onNavigate = vi.fn();

    render(<NotificationsPanel appContext="STUDENT" onNavigate={onNavigate} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir conteúdo' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Abrir conteúdo' }));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith({
      version: 1,
      appContext: 'STUDENT',
      entityType: 'booking',
      entityId: bookingId,
      action: 'details',
    }));
    expect(markNotificationAsRead).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222');
  });
});
