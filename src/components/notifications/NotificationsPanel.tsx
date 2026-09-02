import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, Check, RefreshCw } from 'lucide-react';
import { Notification } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { dbService } from '../../lib/db-service';
import { formatDateTimeBR } from '../../lib/date-format';
import { NOTIFICATIONS_CHANGED } from '../ui/NotificationIndicator';
import { targetFromNotification, type NotificationNavigationTarget } from '../../lib/notification-navigation';
import { PushNotificationOptIn } from './PushNotificationOptIn';

interface NotificationsPanelProps {
  appContext: NonNullable<Notification['appContext']>;
  userId?: string;
  onNavigate?: (target: NotificationNavigationTarget) => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ appContext, userId, onNavigate }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await dbService.getMyNotifications(appContext);
      setNotifications(rows);
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to load notifications:', err);
      setError('Não foi possível carregar suas notificações.');
      setNotifications([]);
    } finally {
      setLoading(false);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [appContext]);

  const markAsRead = async (notificationId: string): Promise<boolean> => {
    setMarkingId(notificationId);
    setError(null);
    try {
      await dbService.markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true, readAt: new Date().toISOString() }
            : notification
        )
      );
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
      return true;
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to mark notification as read:', err);
      setError('Não foi possível marcar a notificação como lida.');
      return false;
    } finally {
      setMarkingId(null);
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    setIsMarkingAll(true);
    setError(null);
    try {
      await dbService.markAllNotificationsAsRead(appContext);
      const readAt = new Date().toISOString();
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true, readAt })));
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to mark all notifications as read:', err);
      setError('Não foi possível marcar as notificações como lidas.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const openNotification = async (notification: Notification) => {
    const resolved = targetFromNotification(notification);
    if (!resolved.ok || !onNavigate) return;
    if (!notification.isRead && !(await markAsRead(notification.id))) return;
    onNavigate(resolved.target);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-3 border-b border-slate-100 p-4">
        <div className="flex min-w-0 items-start gap-2">
          <div className="relative mt-0.5 shrink-0">
            <Bell className="h-5 w-5 text-slate-800" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-4 h-4 rounded-full bg-amber-400 text-[10px] font-black text-slate-950 flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-900">Notificações</h3>
            <p className="max-w-[22rem] text-[11px] leading-relaxed text-slate-500">Atualizações importantes sobre suas aulas</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {unreadCount > 0 && (
            <Button className="min-w-0 flex-1 sm:flex-none" variant="ghost" size="sm" onClick={markAllAsRead} isLoading={isMarkingAll} leftIcon={<Check className="w-3.5 h-3.5" />}>
              Ler todas
            </Button>
          )}
          <Button className="min-w-0 flex-1 sm:flex-none" variant="ghost" size="sm" onClick={loadNotifications} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Atualizar
          </Button>
        </div>
      </div>

      {appContext !== 'ADMIN' && (
        <div className="border-b border-slate-100 p-4">
          <PushNotificationOptIn appContext={appContext} userId={userId} onRegistered={() => void loadNotifications()} />
        </div>
      )}

      {error && (
        <div role="alert" className="m-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div aria-busy="true" aria-label="Carregando notificações" className="space-y-3 p-4">{[1, 2, 3].map((item) => <div key={item} aria-hidden="true" className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm font-black text-slate-800">Tudo tranquilo por aqui.</p>
          <p className="mt-1 text-xs text-slate-500">Você ainda não possui novas notificações.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 ${
                notification.isRead ? 'bg-white' : 'bg-amber-50/50'
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words font-black text-sm text-[var(--mazzi-text)]">{notification.title}</p>
                  {!notification.isRead && <Badge variant="primary">Nova</Badge>}
                </div>
                <p className="text-xs text-slate-600 mt-1">{notification.body}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {formatDateTimeBR(notification.createdAt)}
                </p>
                {onNavigate && targetFromNotification(notification).ok && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 px-0 text-xs font-black text-amber-700"
                    onClick={() => void openNotification(notification)}
                    disabled={markingId === notification.id}
                  >
                    Abrir conteúdo
                  </Button>
                )}
              </div>

              {!notification.isRead && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAsRead(notification.id)}
                  isLoading={markingId === notification.id}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                >
                  Lida
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
