import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, Check, RefreshCw } from 'lucide-react';
import { Notification } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { dbService } from '../../lib/db-service';

export const NotificationsPanel: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await dbService.getMyNotifications();
      setNotifications(rows);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar notificações.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const markAsRead = async (notificationId: string) => {
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
    } catch (err: any) {
      setError(err?.message || 'Não foi possível marcar a notificação como lida.');
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="w-5 h-5 text-slate-800" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-4 h-4 rounded-full bg-amber-400 text-[10px] font-black text-slate-950 flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Notificações</h3>
            <p className="text-[11px] text-slate-500">Alertas persistentes dentro da MAZZI</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadNotifications}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-6 text-center text-xs font-bold text-slate-500">Carregando notificações...</div>
      ) : notifications.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">
          Nenhuma notificação por enquanto.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 flex items-start justify-between gap-3 ${
                notification.isRead ? 'bg-white' : 'bg-amber-50/50'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-black text-sm text-slate-900 truncate">{notification.title}</p>
                  {!notification.isRead && <Badge variant="primary">Nova</Badge>}
                </div>
                <p className="text-xs text-slate-600 mt-1">{notification.body}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {new Date(notification.createdAt).toLocaleString('pt-BR')}
                </p>
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
