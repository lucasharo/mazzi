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
      className={`rounded-2xl border p-4 transition-all ${
        onSelect ? 'cursor-pointer hover:border-slate-300' : ''
      } ${
        isSelected
          ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20'
          : 'border-slate-200/80 bg-white'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
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
        <Badge variant="info" size="sm">
          {vehicle.vehicleType === 'MOTORCYCLE' ? 'Moto' : 'Carro'}
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
