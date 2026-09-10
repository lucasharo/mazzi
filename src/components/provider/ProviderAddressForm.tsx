import React, { useRef, useState } from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import { Input } from '../ui/Input';
import { ButtonBase } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { LocationAddressField } from '../search/LocationAddressField';
import { maskPostalCode, normalizePostalCode } from '../../domain/maps/awesomeapi-cep';
import { activeGeocodingProvider, LocationSuggestion } from '../../domain/maps/geocoding-provider';
import { applyProviderAddressSuggestion, isArtificialHouseNumber, ProviderAddressFormValue, validateProviderAddressForm } from '../../domain/maps/provider-address-payload';
import { resolveProviderAddress } from '../../domain/maps/provider-address-resolution';
import { LocationPinPicker } from '../maps/LocationPinPicker';

export type { ProviderAddressFormValue } from '../../domain/maps/provider-address-payload';

interface Props {
  value: ProviderAddressFormValue;
  onChange: (value: ProviderAddressFormValue) => void;
  idPrefix: string;
}

export const ProviderAddressForm: React.FC<Props> = ({ value, onChange, idPrefix }) => {
  const [addressMessage, setAddressMessage] = useState<string | null>(null);
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const modeRequestRef = useRef(0);
  const mode = value.locationMode || 'STANDARD_ADDRESS';
  const isNoNumber = mode === 'NO_HOUSE_NUMBER';
  const isMapPin = mode === 'MAP_PIN';

  const selectManualAddress = (suggestion: LocationSuggestion) => {
    onChange(applyProviderAddressSuggestion(value, suggestion));
  };

  const useCurrentAddress = () => {
    if (isLocatingAddress || !navigator.geolocation) {
      setAddressMessage('A localização do dispositivo não está disponível. Pesquise o endereço manualmente.');
      return;
    }
    setIsLocatingAddress(true);
    setAddressMessage(null);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      void activeGeocodingProvider.reverseGeocode(coords.latitude, coords.longitude)
        .then((suggestion) => onChange(applyProviderAddressSuggestion(value, suggestion)))
        .catch(() => setAddressMessage('Não foi possível identificar o endereço atual. Pesquise o endereço manualmente.'))
        .finally(() => setIsLocatingAddress(false));
    }, () => {
      setAddressMessage('Permita o acesso à localização ou pesquise o endereço manualmente.');
      setIsLocatingAddress(false);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };

  const setMode = async (nextMode: ProviderAddressFormValue['locationMode']) => {
    const modeRequestId = ++modeRequestRef.current;
    const nextValue = { ...value, locationMode: nextMode, houseNumber: nextMode === 'STANDARD_ADDRESS' ? value.houseNumber : '', address: undefined };
    onChange(nextValue);
    if (nextMode === 'NO_HOUSE_NUMBER' && nextValue.addressLine1.trim() && nextValue.city.trim() && nextValue.state.trim()) {
      try {
        const streetResult = await resolveProviderAddress({ street: nextValue.addressLine1.trim(), houseNumber: null, postalCode: normalizePostalCode(nextValue.postalCode), city: nextValue.city.trim(), stateCode: nextValue.state.trim().toUpperCase(), countryCode: 'br' });
        if (modeRequestId !== modeRequestRef.current) return;
        onChange({ ...nextValue, address: { ...streetResult, locationMode: 'NO_HOUSE_NUMBER', noHouseNumber: true, locationConfirmed: true, confirmationMethod: 'GEOAPIFY' } });
      } catch { /* the map can still be used to confirm the street location */ }
    }
  };
  const confirmPin = async (latitude: number, longitude: number) => {
    ++modeRequestRef.current;
    const returnMode = isNoNumber || isMapPin ? 'NO_HOUSE_NUMBER' as const : 'STANDARD_ADDRESS' as const;
    try {
      const reverse = await activeGeocodingProvider.reverseGeocode(latitude, longitude);
      const inferredHouseNumber = reverse.houseNumber?.trim() || '';
      const resolvedMode = inferredHouseNumber ? 'STANDARD_ADDRESS' as const : returnMode;
      const resolvedNeighborhood = value.neighborhood || reverse.neighborhood;
      const resolvedCity = value.city || reverse.city;
      const resolvedState = reverse.stateCode || value.state;
      onChange({ ...value, locationMode: resolvedMode, addressLine1: reverse.street || value.addressLine1, neighborhood: resolvedNeighborhood, city: resolvedCity, state: resolvedState, postalCode: normalizePostalCode(reverse.postalCode || value.postalCode), houseNumber: inferredHouseNumber || (resolvedMode === 'NO_HOUSE_NUMBER' ? '' : value.houseNumber), address: { ...reverse, postalCode: normalizePostalCode(reverse.postalCode || value.postalCode), neighborhood: resolvedNeighborhood, city: resolvedCity, state: resolvedState, latitude, longitude, source: inferredHouseNumber ? 'GEOAPIFY' : 'MAP_PIN', locationMode: resolvedMode, noHouseNumber: !inferredHouseNumber, locationConfirmed: true, confirmationMethod: 'MAP_PIN' } });
    } catch {
      onChange({ ...value, locationMode: returnMode, houseNumber: returnMode === 'NO_HOUSE_NUMBER' ? '' : value.houseNumber, address: { ...(value.address || {}), latitude, longitude, source: 'MAP_PIN', locationMode: returnMode, noHouseNumber: returnMode === 'NO_HOUSE_NUMBER', locationConfirmed: true, confirmationMethod: 'MAP_PIN', formatted: 'Localização confirmada no mapa' } });
    }
  };

  const addressSearchValue = value.address?.formatted || [value.addressLine1, value.houseNumber].filter(Boolean).join(', ');
  const validation = validateProviderAddressForm(value);
  return <div className="space-y-3">
    {!isMapPin && <LocationAddressField
      id={`${idPrefix}-street`}
      value={addressSearchValue}
      ariaLabel="Buscar endereço operacional"
      onChange={() => { /* The confirmed suggestion is applied atomically below. */ }}
      onClear={() => onChange({ ...value, addressLine1: '', houseNumber: '', neighborhood: '', city: '', state: '', postalCode: '', address: undefined })}
      onConfirm={(suggestion) => { if (suggestion) selectManualAddress(suggestion); }}
      onLocate={useCurrentAddress}
      isLocating={isLocatingAddress}
      label="Endereço"
      placeholder="Digite um endereço, bairro ou local"
      dropdownAlignment="viewport"
      showTriggerClearButton={false}
      inputClassName="min-h-[32px] bg-transparent pr-7 text-sm font-extrabold text-[var(--mazzi-text)] outline-none placeholder:text-slate-400 focus:outline-none"
    />}
    {!isMapPin && <div>
      <label className="mazzi-field-label mb-1.5 block" htmlFor={`${idPrefix}-cep`}>CEP *</label>
      <div className="relative">
        <Input id={`${idPrefix}-cep`} inputMode="numeric" maxLength={9} value={maskPostalCode(value.postalCode)} readOnly className="rounded-2xl" />
      </div>
    </div>}
    {addressMessage && <p className="text-xs text-rose-700" role="alert">{addressMessage}</p>}
    {!isMapPin && <div><label className="mazzi-field-label mb-1.5 block" htmlFor={`${idPrefix}-number`}>Número {isNoNumber ? '' : '*'}</label>{!isNoNumber && <><Input id={`${idPrefix}-number`} value={value.houseNumber} readOnly placeholder="123" className="rounded-2xl" />{isArtificialHouseNumber(value.houseNumber) && <p className="mt-1 text-xs text-rose-700" role="alert">Se o local não possui número, marque “Sem número”.</p>}</>}</div>}
    {!isMapPin && <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={isNoNumber}
        onChange={(event) => { const checked = event.target.checked; void setMode(checked ? 'NO_HOUSE_NUMBER' : 'STANDARD_ADDRESS'); if (checked && (value.postalCode.trim() || value.addressLine1.trim())) setIsMapModalOpen(true); }}
        className="peer sr-only"
      />
      <span aria-hidden="true" className="relative h-6 w-11 rounded-full bg-slate-300 shadow-inner transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[var(--mazzi-yellow)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--mazzi-yellow)] peer-focus-visible:ring-offset-2" />
      Sem número
    </label>}
    <div><label className="mazzi-field-label mb-1.5 block" htmlFor={`${idPrefix}-complement`}>Complemento (opcional)</label><Input id={`${idPrefix}-complement`} value={value.complement} onChange={(event) => onChange({ ...value, complement: event.target.value })} placeholder="Sala 12, bloco B" className="rounded-2xl" /></div>
    {!isMapPin && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><label className="mazzi-field-label mb-1 block">Bairro</label><Input value={value.neighborhood} readOnly onChange={() => undefined} className="rounded-2xl" /></div><div><label className="mazzi-field-label mb-1 block">Cidade</label><Input value={value.city} readOnly onChange={() => undefined} className="rounded-2xl" /></div><div><label className="mazzi-field-label mb-1 block">UF</label><Input value={value.state} readOnly maxLength={2} onChange={() => undefined} className="rounded-2xl" /></div></div>}
    {value.address && validation.valid && <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" /> {isMapPin ? 'Localização confirmada no mapa' : isNoNumber ? 'Endereço da rua localizado' : `Endereço localizado: ${value.address.formatted || value.address.addressLine1 || 'endereço confirmado'}`}</div>}
    <div className="flex flex-wrap gap-2">
      {(isNoNumber || isMapPin) && (value.postalCode.trim() || value.addressLine1.trim()) && <ButtonBase type="button" className="text-xs font-bold text-[var(--mazzi-dark)] underline" onClick={() => { setIsMapModalOpen(true); }}><MapPin className="mr-1 inline h-3.5 w-3.5" /> Confirmar localização no mapa</ButtonBase>}
    </div>
    {(isNoNumber || isMapPin) && <p className="text-xs text-slate-600">{isNoNumber ? 'Este local não possui número. O mapa é opcional para ajustar a localização.' : 'Indique o ponto operacional diretamente no mapa.'}</p>}
    <Modal
      id={`${idPrefix}-location-map`}
      isOpen={isMapModalOpen}
      onClose={() => setIsMapModalOpen(false)}
      title="Confirmar localização no mapa"
      size="lg"
      portal
      layer="nested"
    >
      <p className="mb-4 text-xs leading-relaxed text-slate-600">Confira o ponto sugerido para o endereço informado e confirme a localização operacional.</p>
      <LocationPinPicker latitude={value.address?.latitude || value.approximateLatitude} longitude={value.address?.longitude || value.approximateLongitude} onConfirm={(lat, lng) => { void confirmPin(lat, lng); setIsMapModalOpen(false); }} />
    </Modal>
  </div>;
};
