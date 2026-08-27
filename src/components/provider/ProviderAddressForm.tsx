import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, MapPin } from 'lucide-react';
import { Input } from '../ui/Input';
import { ButtonBase } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { AddressAutocomplete } from '../search/AddressAutocomplete';
import { awesomeApiCepProvider, maskPostalCode, normalizePostalCode, BrazilianPostalAddress } from '../../domain/maps/awesomeapi-cep';
import { activeGeocodingProvider, LocationSuggestion } from '../../domain/maps/geocoding-provider';
import { isArtificialHouseNumber, ProviderAddressFormValue, validateProviderAddressForm } from '../../domain/maps/provider-address-payload';
import { resolveProviderAddress } from '../../domain/maps/provider-address-resolution';
import { LocationPinPicker } from '../maps/LocationPinPicker';

export type { ProviderAddressFormValue } from '../../domain/maps/provider-address-payload';

interface Props {
  value: ProviderAddressFormValue;
  onChange: (value: ProviderAddressFormValue) => void;
  idPrefix: string;
}

function applyCep(value: ProviderAddressFormValue, cep: BrazilianPostalAddress): ProviderAddressFormValue {
  return { ...value, locationMode: value.locationMode === 'MAP_PIN' ? 'MAP_PIN' : value.locationMode || 'STANDARD_ADDRESS', postalCode: normalizePostalCode(cep.postalCode), addressLine1: cep.street, neighborhood: cep.neighborhood, city: cep.city, state: cep.stateCode, approximateLatitude: cep.approximateLatitude, approximateLongitude: cep.approximateLongitude, address: undefined };
}

export const ProviderAddressForm: React.FC<Props> = ({ value, onChange, idPrefix }) => {
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const requestRef = useRef(0);
  const modeRequestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const mode = value.locationMode || 'STANDARD_ADDRESS';
  const isNoNumber = mode === 'NO_HOUSE_NUMBER';
  const isMapPin = mode === 'MAP_PIN';

  useEffect(() => {
    const normalized = normalizePostalCode(value.postalCode);
    if (normalized.length !== 8) { setCepMessage(null); return; }
    const requestId = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLookingUpCep(true);
    setCepMessage(null);
    awesomeApiCepProvider.lookupPostalCode(normalized, controller.signal)
      .then((cep) => { if (requestId === requestRef.current) onChange(applyCep(value, cep)); })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        setCepMessage(error instanceof Error && error.message === 'CEP_NOT_FOUND' ? 'Não encontramos esse CEP.' : 'Não foi possível consultar o CEP agora.');
      })
      .finally(() => { if (requestId === requestRef.current) setIsLookingUpCep(false); });
    return () => controller.abort();
  }, [value.postalCode]);

  const selectManualAddress = (suggestion: LocationSuggestion) => {
    onChange({ ...value, addressLine1: suggestion.street || suggestion.addressLine1 || suggestion.formattedAddress, neighborhood: suggestion.neighborhood, city: suggestion.city, state: suggestion.stateCode || suggestion.state, postalCode: normalizePostalCode(suggestion.postalCode || value.postalCode), address: { formatted: suggestion.formattedAddress, addressLine1: suggestion.addressLine1, addressLine2: suggestion.addressLine2, street: suggestion.street, houseNumber: suggestion.houseNumber, neighborhood: suggestion.neighborhood, city: suggestion.city, state: suggestion.state, stateCode: suggestion.stateCode, postalCode: normalizePostalCode(suggestion.postalCode || value.postalCode), country: suggestion.country, countryCode: suggestion.countryCode, latitude: suggestion.latitude, longitude: suggestion.longitude, placeId: suggestion.placeId, source: 'GEOAPIFY' } });
    setManualSearch(false);
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
      } catch { /* map can still start from AwesomeAPI coordinates or the regional fallback */ }
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

  const validation = validateProviderAddressForm(value);
  return <fieldset className="space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-slate-50/60 p-4">
    <legend className="px-1 text-sm font-bold text-[var(--mazzi-dark)]">Endereço operacional</legend>
    {!isMapPin && <div>
      <label className="mazzi-field-label mb-1.5 block" htmlFor={`${idPrefix}-cep`}>CEP *</label>
      <div className="relative">
        <Input id={`${idPrefix}-cep`} inputMode="numeric" maxLength={9} value={maskPostalCode(value.postalCode)} onChange={(event) => onChange({ ...value, postalCode: normalizePostalCode(event.target.value), address: undefined })} placeholder="00000-000" className="rounded-2xl pr-10" />
        {isLookingUpCep && <LoaderCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--mazzi-muted)]" aria-label="Consultando CEP" />}
      </div>
      {cepMessage && <p className="mt-1 text-xs text-rose-700" role="alert">{cepMessage}</p>}
    </div>}
    {!isMapPin && <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
      <div><label className="mazzi-field-label mb-1.5 block" htmlFor={`${idPrefix}-street`}>Logradouro *</label><Input id={`${idPrefix}-street`} value={value.addressLine1} readOnly={normalizePostalCode(value.postalCode).length === 8 && !manualSearch} onChange={(event) => onChange({ ...value, addressLine1: event.target.value, address: undefined })} className="rounded-2xl" /></div>
      <div><label className="mazzi-field-label mb-1.5 block" htmlFor={`${idPrefix}-number`}>Número {isNoNumber ? '' : '*'}</label>{!isNoNumber && <><Input id={`${idPrefix}-number`} value={value.houseNumber} onChange={(event) => onChange({ ...value, houseNumber: event.target.value, address: undefined })} placeholder="123" className="rounded-2xl" />{isArtificialHouseNumber(value.houseNumber) && <p className="mt-1 text-xs text-rose-700" role="alert">Se o local não possui número, marque “Sem número”.</p>}</>}</div>
    </div>}
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
    {!isMapPin && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><label className="mazzi-field-label mb-1 block">Bairro</label><Input value={value.neighborhood} readOnly={!manualSearch} onChange={(event) => onChange({ ...value, neighborhood: event.target.value, address: undefined })} className="rounded-2xl" /></div><div><label className="mazzi-field-label mb-1 block">Cidade</label><Input value={value.city} readOnly={!manualSearch} onChange={(event) => onChange({ ...value, city: event.target.value, address: undefined })} className="rounded-2xl" /></div><div><label className="mazzi-field-label mb-1 block">UF</label><Input value={value.state} readOnly={!manualSearch} maxLength={2} onChange={(event) => onChange({ ...value, state: event.target.value.toUpperCase(), address: undefined })} className="rounded-2xl" /></div></div>}
    {value.address && validation.valid ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" /> {isMapPin ? 'Localização confirmada no mapa' : isNoNumber ? 'Endereço da rua localizado' : `Endereço localizado: ${value.address.formatted || value.address.addressLine1 || 'endereço confirmado'}`}</div> : <ButtonBase type="button" className="text-left text-xs font-bold text-[var(--mazzi-dark)] underline" onClick={() => setManualSearch(true)}>Buscar endereço manualmente</ButtonBase>}
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
      useHistory={false}
      portal
      layer="nested"
    >
      <p className="mb-4 text-xs leading-relaxed text-slate-600">Confira o ponto sugerido para o endereço informado e confirme a localização operacional.</p>
      <LocationPinPicker latitude={value.address?.latitude || value.approximateLatitude} longitude={value.address?.longitude || value.approximateLongitude} onConfirm={(lat, lng) => { void confirmPin(lat, lng); setIsMapModalOpen(false); }} />
    </Modal>
    {manualSearch && <AddressAutocomplete value={value.addressLine1} ariaLabel="Buscar endereço manualmente" onChange={(addressLine1) => onChange({ ...value, addressLine1, address: undefined })} onSelect={selectManualAddress} inputClassName="min-h-11 rounded-2xl border border-[var(--mazzi-border)] px-3.5 py-2.5 text-sm" />}
  </fieldset>;
};
