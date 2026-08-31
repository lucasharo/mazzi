import React, { useEffect, useState } from 'react';
import { dbService } from '../../lib/db-service';
import { Notification } from '../../types';

const NOTIFICATIONS_CHANGED_EVENT = 'mazzi:notifications-changed';

export interface NotificationIndicatorProps {
  children: React.ReactNode;
  className?: string;
  appContext: NonNullable<Notification['appContext']>;
}

/** Shared unread counter for notification buttons across the three PWAs. */
export const NotificationIndicator: React.FC<NotificationIndicatorProps> = ({ children, className = '', appContext }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    const loadUnreadCount = async () => {
      try {
        const count = await dbService.getMyUnreadNotificationCount(appContext);
        if (active) setUnreadCount(count);
      } catch {
        if (active) setUnreadCount(0);
      }
    };

    const handleNotificationsChanged = () => { void loadUnreadCount(); };
    void loadUnreadCount();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
    };
  }, [appContext]);

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      {children}
      {unreadCount > 0 && (
        <span
          aria-label={`${unreadCount} notificações não lidas`}
          className={`pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[var(--mazzi-yellow)] text-[9px] font-black leading-none text-[var(--mazzi-dark)] ${unreadCount > 9 ? 'px-1' : 'aspect-square px-0'}`}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </span>
  );
};

export const NOTIFICATIONS_CHANGED = NOTIFICATIONS_CHANGED_EVENT;
