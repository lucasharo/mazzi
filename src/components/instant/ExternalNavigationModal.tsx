import React from 'react';
import { ExternalLink, MapPin, X } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import {
  ExternalNavigationTarget,
  getAvailableNavigationApps,
  isValidNavigationTarget,
  NavigationApp,
  openExternalNavigation,
} from '../../lib/external-navigation-service';

interface ExternalNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  target?: ExternalNavigationTarget | null;
}

const GoogleMapsIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" />
    <path d="M12 6.5A2.5 2.5 0 0 1 14.5 9c0 1.04-.63 1.93-1.53 2.32L12 9V6.5z" fill="#4285F4" />
    <path d="M9.53 11.32A2.5 2.5 0 0 1 9.5 9c0-1.04.63-1.93 1.53-2.32L12 9v2.5l-2.47-.18z" fill="#FBBC04" />
    <path d="M12 11.5a2.5 2.5 0 0 1-2.47-2.18L12 9v2.5z" fill="#34A853" />
    <circle cx="12" cy="9" r="2.5" fill="#FFFFFF" />
  </svg>
);

const WazeIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#33CCFF" />
    <path
      d="M12 5C7.58 5 4 8.13 4 12c0 2.1.95 4 2.5 5.3L6 19l2.1-.7A7.95 7.95 0 0 0 12 19c4.42 0 8-3.13 8-7s-3.58-7-8-7z"
      fill="#FFFFFF"
    />
    <circle cx="9" cy="11.5" r="1.25" fill="#1E293B" />
    <circle cx="15" cy="11.5" r="1.25" fill="#1E293B" />
    <path d="M9.5 14.5c.8 1 2.2 1 3 0" stroke="#1E293B" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="8" cy="17.5" r="1.2" fill="#1E293B" />
    <circle cx="16" cy="17.5" r="1.2" fill="#1E293B" />
  </svg>
);

const AppleMapsIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#1C1C1E" />
    <path d="M4 18L10 6L14 13L20 18H4Z" fill="#30D158" opacity="0.85" />
    <path d="M12 4L18 18L12 15L6 18L12 4Z" fill="#0A84FF" />
    <circle cx="12" cy="12" r="2.2" fill="#FFFFFF" />
  </svg>
);

const WebMapsIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="4" fill="#F8FAFC" stroke="#64748B" strokeWidth="1.5" />
    <line x1="2" y1="9" x2="22" y2="9" stroke="#64748B" strokeWidth="1.5" />
    <circle cx="5.5" cy="6.5" r="1" fill="#EF4444" />
    <circle cx="8.5" cy="6.5" r="1" fill="#F59E0B" />
    <circle cx="11.5" cy="6.5" r="1" fill="#10B981" />
    <circle cx="12" cy="14.5" r="3" fill="#3B82F6" opacity="0.9" />
  </svg>
);

const getNavigationAppIcon = (appId: NavigationApp) => {
  switch (appId) {
    case 'google':
      return <GoogleMapsIcon className="h-6 w-6 shrink-0" />;
    case 'waze':
      return <WazeIcon className="h-6 w-6 shrink-0" />;
    case 'apple':
      return <AppleMapsIcon className="h-6 w-6 shrink-0" />;
    case 'web':
    default:
      return <WebMapsIcon className="h-6 w-6 shrink-0" />;
  }
};

export const ExternalNavigationModal: React.FC<ExternalNavigationModalProps> = ({
  isOpen,
  onClose,
  target,
}) => {
  if (!isOpen || !isValidNavigationTarget(target)) {
    return null;
  }

  const availableApps = getAvailableNavigationApps();

  const handleOpenApp = (app: NavigationApp) => {
    openExternalNavigation(target, app);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Abrir rota no mapa"
      ariaLabel="Opções de navegação externa"
    >
      <div className="space-y-4" data-component="external-navigation-modal">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Ponto de Encontro da Aula</p>
              <p className="mt-0.5 text-sm font-extrabold text-[var(--mazzi-dark)] break-words">
                {target.label || 'Endereço indicado no mapa'}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                Coordenadas exatas: {target.latitude.toFixed(5)}, {target.longitude.toFixed(5)}
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-600">
          Escolha o aplicativo de navegação de sua preferência para visualizar o trajeto:
        </p>

        <div className="space-y-2">
          {availableApps.map((app) => (
            <Button
              key={app.id}
              type="button"
              variant="outline"
              onClick={() => handleOpenApp(app.id)}
              className="flex w-full min-h-12 items-center justify-between gap-3 rounded-2xl border border-[var(--mazzi-border)] bg-white px-4 py-3 text-left font-extrabold text-[var(--mazzi-dark)] transition hover:bg-slate-50 hover:border-slate-300"
              leftIcon={getNavigationAppIcon(app.id)}
              rightIcon={<ExternalLink className="h-4 w-4 text-slate-400" aria-hidden="true" />}
            >
              <span>{app.name}</span>
            </Button>
          ))}
        </div>

        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onClose}
            leftIcon={<X className="h-4 w-4" aria-hidden="true" />}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
};

