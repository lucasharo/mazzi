import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const unreadLoadInFlightRef = useRef<Promise<void> | null>(null);
  const hasLoadedRef = useRef(false);
  const activeRef = useRef(true);

  const loadUnreadCount = useCallback(async (force = false) => {
    if (!force && hasLoadedRef.current) return;
    if (unreadLoadInFlightRef.current) return unreadLoadInFlightRef.current;

    const request = (async () => {
      try {
        const count = await dbService.getMyUnreadNotificationCount(appContext);
        if (activeRef.current) setUnreadCount(count);
        hasLoadedRef.current = true;
      } catch {
        if (activeRef.current) setUnreadCount(0);
      }
    })();

    unreadLoadInFlightRef.current = request;
    try {
      await request;
    } finally {
      if (unreadLoadInFlightRef.current === request) unreadLoadInFlightRef.current = null;
    }
  }, [appContext]);

  useEffect(() => {
    activeRef.current = true;
    hasLoadedRef.current = false;

    const handleNotificationsChanged = () => { void loadUnreadCount(true); };
    void loadUnreadCount();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
    return () => {
      activeRef.current = false;
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
    };
  }, [appContext, loadUnreadCount]);

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
