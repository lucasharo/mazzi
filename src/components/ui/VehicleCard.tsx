import React from 'react';
import { Car, Bike, Sparkles } from 'lucide-react';
import { Vehicle } from '../../types';
import { StatusBadge } from './StatusBadge';
import { Badge } from './Badge';

export interface VehicleCardProps {
  vehicle: Vehicle;
  isSelected?: boolean;
  onSelect?: (vehicle: Vehicle) => void;
  id?: string;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  isSelected = false,
  onSelect,
  id,
}) => {
  return (
    <div
      id={id || `vehicle-card-${vehicle.id}`}
      onClick={() => onSelect && onSelect(vehicle)}
      className={`mazzi-card p-5 transition-all ${
        onSelect ? 'cursor-pointer hover:border-slate-300' : ''
      } ${
        isSelected
          ? 'ring-2 ring-[var(--mazzi-yellow)]'
          : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)]">
            {vehicle.category === 'A' ? (
              <Bike className="w-5 h-5" />
            ) : (
              <Car className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              {vehicle.brand} {vehicle.model}
            </h4>
            <p className="text-xs text-slate-500">Ano {vehicle.year}</p>
          </div>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Badge variant="primary" size="sm">
          Cat. {vehicle.category}
        </Badge>
        <Badge variant="default" size="sm">
          {vehicle.transmission === 'MANUAL'
            ? 'Manual'
            : vehicle.transmission === 'AUTOMATIC'
            ? 'Automático'
            : 'N/A'}
        </Badge>
        <span className="text-xs text-slate-400 font-mono ml-auto">
          Placa {vehicle.licensePlateMasked || '***-****'}
        </span>
      </div>

      {isSelected && (
        <div className="mt-2.5 pt-2 border-t border-emerald-200/60 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Veículo Selecionado</span>
        </div>
      )}
    </div>
  );
};
