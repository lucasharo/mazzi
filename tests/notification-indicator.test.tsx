// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getMyUnreadNotificationCount } = vi.hoisted(() => ({ getMyUnreadNotificationCount: vi.fn() }));

vi.mock('../src/lib/db-service', () => ({
  dbService: { getMyUnreadNotificationCount },
}));

import { NotificationIndicator } from '../src/components/ui/NotificationIndicator';

afterEach(() => cleanup());

describe('NotificationIndicator', () => {
  it('shows the unread count when notifications exist', async () => {
    getMyUnreadNotificationCount.mockReset();
    getMyUnreadNotificationCount.mockResolvedValue(2);

    render(<NotificationIndicator><button type="button">Sino</button></NotificationIndicator>);

    await waitFor(() => expect(screen.getByLabelText('2 notificações não lidas')).toBeTruthy());
  });

  it('does not render a badge when everything is read', async () => {
    getMyUnreadNotificationCount.mockReset();
    getMyUnreadNotificationCount.mockResolvedValue(0);

    render(<NotificationIndicator><button type="button">Sino</button></NotificationIndicator>);

    await waitFor(() => expect(getMyUnreadNotificationCount).toHaveBeenCalled());
    expect(screen.queryByLabelText(/notificações não lidas/)).toBeNull();
  });
});
