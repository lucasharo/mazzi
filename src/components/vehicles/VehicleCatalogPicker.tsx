import React, { useEffect, useMemo, useState } from 'react';
import { Car, LoaderCircle } from 'lucide-react';
import type { VehicleType } from '../../types';
import { ButtonBase } from '../ui/Button';
import { Input } from '../ui/Input';

type CatalogOption = { code: string; name: string };

export interface VehicleCatalogSelection {
  brand: string;
  model: string;
  year: number | '';
}

interface VehicleCatalogPickerProps {
  vehicleType: VehicleType;
  brand: string;
  model: string;
  year: number | '';
  onChange: (selection: VehicleCatalogSelection) => void;
  disabled?: boolean;
}

const FIPE_API_BASE_URL = 'https://fipe.parallelum.com.br/api/v2';

async function fetchCatalogOptions(path: string, signal: AbortSignal): Promise<CatalogOption[]> {
  const response = await fetch(`${FIPE_API_BASE_URL}/${path}`, { signal });
  if (!response.ok) throw new Error(`FIPE catalog request failed with status ${response.status}`);
  const data = await response.json() as unknown;
  if (!Array.isArray(data)) throw new Error('FIPE catalog response was not a list');
  return data.filter((option): option is CatalogOption => (
    typeof option === 'object' && option !== null
    && typeof (option as CatalogOption).code === 'string'
    && typeof (option as CatalogOption).name === 'string'
  ));
}

const apiVehicleType = (vehicleType: VehicleType) => vehicleType === 'MOTORCYCLE' ? 'motorcycles' : 'cars';

const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const matchesSearch = (label: string, query: string) => {
  const normalizedLabel = normalizeSearch(label);
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;
  return normalizedLabel.startsWith(normalizedQuery)
    || normalizedLabel.split(/\s+/).some((word) => word.startsWith(normalizedQuery));
};

interface SuggestionListProps {
  id: string;
  options: CatalogOption[];
  onSelect: (option: CatalogOption) => void;
}

const SuggestionList: React.FC<SuggestionListProps> = ({ id, options, onSelect }) => (
  <div id={id} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-[var(--mazzi-border)] bg-white p-1.5 shadow-[0_14px_30px_rgba(32,33,38,.16)]">
    {options.map((option) => (
      <ButtonBase
        key={option.code}
        type="button"
        role="option"
        className="flex min-h-10 w-full items-center rounded-xl px-3 py-2 text-left text-sm text-[var(--mazzi-text)] transition-colors hover:bg-[var(--mazzi-yellow-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mazzi-dark)]"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(option)}
      >
        <span className="min-w-0 truncate">{option.name}</span>
      </ButtonBase>
    ))}
  </div>
);

export const VehicleCatalogPicker: React.FC<VehicleCatalogPickerProps> = ({
  vehicleType,
  brand,
  model,
  year,
  onChange,
  disabled = false,
}) => {
  const [brands, setBrands] = useState<CatalogOption[]>([]);
  const [models, setModels] = useState<CatalogOption[]>([]);
  const [years, setYears] = useState<CatalogOption[]>([]);
  const [brandCode, setBrandCode] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [activeField, setActiveField] = useState<'brand' | 'model' | 'year' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setBrands([]);
    setModels([]);
    setYears([]);
    setBrandCode('');
    setModelCode('');

    fetchCatalogOptions(`${apiVehicleType(vehicleType)}/brands`, controller.signal)
      .then(setBrands)
      .catch((catalogError: unknown) => {
        if ((catalogError as { name?: string })?.name !== 'AbortError') {
          setError('Catálogo temporariamente indisponível. O preenchimento manual continua disponível.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [vehicleType]);

  useEffect(() => {
    if (!brandCode) return undefined;
    const controller = new AbortController();
    setIsLoading(true);
    setModels([]);
    setYears([]);
    setModelCode('');

    fetchCatalogOptions(`${apiVehicleType(vehicleType)}/brands/${brandCode}/models`, controller.signal)
      .then(setModels)
      .catch((catalogError: unknown) => {
        if ((catalogError as { name?: string })?.name !== 'AbortError') {
          setError('Não foi possível carregar os modelos desta marca.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [brandCode, vehicleType]);

  useEffect(() => {
    if (!brandCode || !modelCode) return undefined;
    const controller = new AbortController();
    setIsLoading(true);

    fetchCatalogOptions(`${apiVehicleType(vehicleType)}/brands/${brandCode}/models/${modelCode}/years`, controller.signal)
      .then(setYears)
      .catch((catalogError: unknown) => {
        if ((catalogError as { name?: string })?.name !== 'AbortError') {
          setError('Não foi possível carregar os anos deste modelo.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [brandCode, modelCode, vehicleType]);

  const filteredBrands = useMemo(() => brands.filter((option) => matchesSearch(option.name, brand)).slice(0, 8), [brand, brands]);
  const filteredModels = useMemo(() => models.filter((option) => matchesSearch(option.name, model)).slice(0, 8), [model, models]);
  const filteredYears = useMemo(() => years.filter((option) => matchesSearch(option.name, String(year))).slice(0, 8), [year, years]);
  const yearSuggestions = useMemo(
    () => filteredYears.map((option) => ({ ...option, name: option.name.slice(0, 4) })),
    [filteredYears],
  );

  const selectBrand = (option: CatalogOption) => {
    setBrandCode(option.code);
    setModelCode('');
    setActiveField(null);
    onChange({ brand: option.name, model: '', year });
  };

  const selectModel = (option: CatalogOption) => {
    setModelCode(option.code);
    setActiveField(null);
    onChange({ brand, model: option.name, year });
  };

  const selectYear = (option: CatalogOption) => {
    const selectedYear = Number.parseInt(option.name.slice(0, 4), 10);
    if (!Number.isFinite(selectedYear)) return;
    setActiveField(null);
    onChange({ brand, model, year: selectedYear });
  };

  return (
    <div data-component="vehicle-catalog-picker" className="space-y-2 text-left">
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <Car className="h-3.5 w-3.5" aria-hidden="true" />
        Digite para buscar marca, modelo ou ano no catálogo FIPE.
        {isLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      </p>
      {error && <p className="text-xs font-medium text-amber-700" role="status">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
          <Input
            label="Marca *"
            value={brand}
            onChange={(event) => {
              setBrandCode('');
              setModelCode('');
              setModels([]);
              setYears([]);
              setActiveField('brand');
              onChange({ brand: event.target.value, model: '', year });
            }}
            onFocus={() => setActiveField('brand')}
            onBlur={() => setActiveField(null)}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls="vehicle-brand-suggestions"
            placeholder="Ex: Volkswagen, Honda"
            disabled={disabled}
          />
          {activeField === 'brand' && filteredBrands.length > 0 && (
            <SuggestionList id="vehicle-brand-suggestions" options={filteredBrands} onSelect={selectBrand} />
          )}
        </div>
        <div className="relative">
          <Input
            label="Modelo *"
            value={model}
            onChange={(event) => {
              setModelCode('');
              setYears([]);
              setActiveField('model');
              onChange({ brand, model: event.target.value, year });
            }}
            onFocus={() => setActiveField('model')}
            onBlur={() => setActiveField(null)}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls="vehicle-model-suggestions"
            placeholder="Ex: Polo, CG 160"
            disabled={disabled || (!brandCode && !brand.trim())}
          />
          {activeField === 'model' && filteredModels.length > 0 && (
            <SuggestionList id="vehicle-model-suggestions" options={filteredModels} onSelect={selectModel} />
          )}
        </div>
        <div className="relative">
          <Input
            label="Ano *"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={year === '' ? '' : String(year)}
            onChange={(event) => {
              setActiveField('year');
              const rawYear = event.target.value.replace(/\D/g, '').slice(0, 4);
              onChange({ brand, model, year: rawYear === '' ? '' : Number(rawYear) });
            }}
            onFocus={() => setActiveField('year')}
            onBlur={() => setActiveField(null)}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls="vehicle-year-suggestions"
            helperText={`Máximo de 12 anos de fabricação (a partir de ${new Date().getFullYear() - 12}).`}
            disabled={disabled || (!modelCode && !model.trim())}
          />
          {activeField === 'year' && yearSuggestions.length > 0 && (
            <SuggestionList id="vehicle-year-suggestions" options={yearSuggestions} onSelect={selectYear} />
          )}
        </div>
      </div>
    </div>
  );
};
