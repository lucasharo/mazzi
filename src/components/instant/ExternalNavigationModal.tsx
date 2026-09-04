import React from 'react';
import { Compass, ExternalLink, MapPin, X } from 'lucide-react';
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
              className="flex w-full min-h-12 items-center justify-between gap-3 rounded-2xl border border-[var(--mazzi-border)] bg-white px-4 py-3 text-left font-extrabold text-[var(--mazzi-dark)] transition hover:border-amber-400 hover:bg-amber-50"
              leftIcon={<Compass className="h-5 w-5 text-amber-600" aria-hidden="true" />}
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
