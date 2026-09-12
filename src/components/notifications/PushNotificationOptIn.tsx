import React, { useEffect, useState } from 'react';
import { Bell, Check, ShieldAlert } from 'lucide-react';
import type { NotificationAppContext } from '../../types';
import {
  getPushCapability,
  getPushCapabilityAsync,
  hasStoredPushDevice,
  registerPushDevice,
  requestPushPermission,
  type PushPermissionState,
} from '../../lib/push-device-registry';
import { isFirebaseMessagingConfigured } from '../../lib/firebase-messaging';
import { Button } from '../ui/Button';
import { isNativeApp } from '../../lib/native-platform';

type PushOptInStatus = 'idle' | 'loading' | 'active' | 'disabled' | 'unsupported' | 'error' | 'not-configured';

interface PushNotificationOptInProps {
  appContext: Extract<NotificationAppContext, 'STUDENT' | 'PRO'>;
  userId?: string;
  onRegistered?: () => void;
}

function statusFromPermission(permission: PushPermissionState): PushOptInStatus {
  if (permission === 'denied') return 'disabled';
  if (permission === 'unsupported') return 'unsupported';
  return 'idle';
}

function getInitialStatus(appContext: PushNotificationOptInProps['appContext'], userId?: string): PushOptInStatus {
  if (!isFirebaseMessagingConfigured() && !isNativeApp()) return 'not-configured';
  if (hasStoredPushDevice(appContext, userId)) return 'active';
  const capability = getPushCapability();
  return statusFromPermission(capability.permission);
}

export const PushNotificationOptIn: React.FC<PushNotificationOptInProps> = ({ appContext, userId, onRegistered }) => {
  const [status, setStatus] = useState<PushOptInStatus>(() => getInitialStatus(appContext, userId));

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!isFirebaseMessagingConfigured() && !isNativeApp()) {
        if (active) setStatus('not-configured');
        return;
      }
      const capability = await getPushCapabilityAsync();
      if (!active) return;
      setStatus(capability.permission === 'granted' && hasStoredPushDevice(appContext, userId)
        ? 'active'
        : statusFromPermission(capability.permission));
    })();
    return () => { active = false; };
  }, [appContext, userId]);

  const activate = async () => {
    if (!isFirebaseMessagingConfigured() && !isNativeApp()) {
      setStatus('not-configured');
      return;
    }

    setStatus('loading');
    try {
      const permission = await requestPushPermission();
      if (permission !== 'granted') {
        setStatus(statusFromPermission(permission));
        return;
      }

      const result = await registerPushDevice({ appContext, userId });
      if (!result.registered) {
        setStatus(result.reason === 'unsupported' ? 'unsupported' : result.reason === 'permission-denied' ? 'disabled' : result.reason === 'not-configured' ? 'not-configured' : 'error');
        return;
      }

      setStatus('active');
      onRegistered?.();
    } catch {
      setStatus('error');
    }
  };

  if (status === 'unsupported') {
    return <p className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-semibold leading-relaxed text-slate-600"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Este navegador não oferece suporte a notificações push.</p>;
  }

  if (status === 'disabled') {
    return <p className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-semibold leading-relaxed text-slate-600"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />As notificações estão desativadas. Você pode continuar usando o MAZZI normalmente.</p>;
  }

  if (status === 'not-configured') {
    return <p className="rounded-2xl bg-slate-50 p-3 text-xs font-semibold leading-relaxed text-slate-600">As notificações push ainda não estão disponíveis neste ambiente.</p>;
  }

  if (status === 'active') {
    return <p role="status" className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800"><Check className="h-4 w-4" aria-hidden="true" />Notificações ativadas neste dispositivo.</p>;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
      <div className="flex items-start gap-2">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-900">Receba avisos importantes</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">Ative as notificações para acompanhar atualizações das suas aulas.</p>
        </div>
      </div>
      {status === 'error' && <p role="alert" className="mt-2 text-xs font-bold text-rose-700">Não foi possível ativar as notificações agora. Tente novamente mais tarde.</p>}
      <Button className="mt-3 w-full" size="sm" onClick={() => void activate()} isLoading={status === 'loading'} leftIcon={<Bell className="h-4 w-4" aria-hidden="true" />}>
        Ativar notificações
      </Button>
    </div>
  );
};
