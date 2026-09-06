import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, LoaderCircle, RotateCcw } from 'lucide-react';
import type { NotificationAppContext, NotificationType } from '../../types';
import { dbService } from '../../lib/db-service';
import { getNotificationPreferenceDefinitions } from '../../lib/notification-preferences';
import { Button } from '../ui/Button';

interface NotificationPreferencesProps {
  appContext: Extract<NotificationAppContext, 'STUDENT' | 'PRO'>;
  showHeading?: boolean;
}

type PreferenceState = Partial<Record<NotificationType, boolean>>;

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ appContext, showHeading = true }) => {
  const definitions = useMemo(() => getNotificationPreferenceDefinitions(appContext), [appContext]);
  const [preferences, setPreferences] = useState<PreferenceState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingType, setLoadingType] = useState<NotificationType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const saved = await dbService.getMyNotificationPreferences();
      setPreferences(saved);
    } catch (loadError) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to load notification preferences:', loadError);
      setError('Não foi possível carregar suas preferências. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const handleToggle = async (type: NotificationType, enabled: boolean) => {
    const previous = preferences[type];
    setPreferences((current) => ({ ...current, [type]: enabled }));
    setLoadingType(type);
    setError(null);
    try {
      await dbService.setMyNotificationPreference(type, enabled);
    } catch (saveError) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to save notification preference:', saveError);
      setPreferences((current) => ({ ...current, [type]: previous }));
      setError('Não foi possível salvar essa preferência. Tente novamente.');
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <section
      className={showHeading ? 'mazzi-compact-card rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs' : ''}
      aria-labelledby={showHeading ? `${appContext.toLowerCase()}-notification-preferences-title` : undefined}
      aria-label={showHeading ? undefined : 'Preferências de notificações'}
    >
      {showHeading && <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700" aria-hidden="true">
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h4 id={`${appContext.toLowerCase()}-notification-preferences-title`} className="text-sm font-bold text-[var(--mazzi-dark)]">
            Preferências de notificações
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Escolha quais eventos você quer acompanhar no aplicativo.
          </p>
        </div>
      </div>}

      {error && (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800" role="alert">
          <span>{error}</span>
          <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2 text-rose-800" onClick={() => void loadPreferences()} disabled={isLoading}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      )}

      <div className={`${showHeading ? 'mt-4' : ''} divide-y divide-slate-100`} aria-busy={isLoading}>
        {isLoading ? (
          <div className="space-y-2" aria-label="Carregando preferências…">
              <p className="flex items-center gap-2 px-1 py-2 text-xs font-semibold text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Carregando preferências…
            </p>
            {definitions.slice(0, 4).map((definition) => (
              <div key={definition.type} className="h-16 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" aria-hidden="true" />
            ))}
          </div>
        ) : error ? (
          <p className="px-1 py-3 text-xs font-medium text-slate-500">
            As opções ficam disponíveis assim que suas preferências forem carregadas.
          </p>
        ) : (
          definitions.map((definition) => {
            const enabled = preferences[definition.type] !== false;
            const inputId = `${appContext.toLowerCase()}-notification-${definition.type.toLowerCase()}`;
            const descriptionId = `${inputId}-description`;
            const Icon = definition.icon;
            const isSaving = loadingType === definition.type;

            return (
              <label key={definition.type} htmlFor={inputId} className={`flex min-h-[72px] cursor-pointer items-center gap-3 py-3 ${isSaving ? 'cursor-wait' : ''}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-slate-800" aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[var(--mazzi-text)]">{definition.label}</span>
                  <span id={descriptionId} className="mt-0.5 block text-xs leading-relaxed text-slate-500">{definition.description}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`hidden text-[10px] font-bold sm:inline ${enabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {enabled ? 'Ativada' : 'Desativada'}
                  </span>
                  <input
                    id={inputId}
                    type="checkbox"
                    className="peer sr-only"
                    checked={enabled}
                    disabled={isSaving || isLoading}
                    aria-describedby={descriptionId}
                    aria-label={`${definition.label}: ${enabled ? 'ativada' : 'desativada'}`}
                    onChange={(event) => void handleToggle(definition.type, event.target.checked)}
                  />
                  <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 shadow-inner transition-colors duration-200 ease-out motion-reduce:transition-none after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 after:ease-out motion-reduce:after:transition-none peer-checked:bg-[var(--mazzi-yellow)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--mazzi-yellow)] peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" />
                </span>
              </label>
            );
          })
        )}
      </div>
    </section>
  );
};
