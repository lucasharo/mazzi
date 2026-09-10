import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Input } from '../ui/Input';
import { LocationAddressField } from '../search/LocationAddressField';
import { maskPostalCode } from '../../domain/maps/awesomeapi-cep';
import { activeGeocodingProvider, LocationSuggestion } from '../../domain/maps/geocoding-provider';
import { applyProviderAddressSuggestion, isArtificialHouseNumber, ProviderAddressFormValue, validateProviderAddressForm } from '../../domain/maps/provider-address-payload';

export type { ProviderAddressFormValue } from '../../domain/maps/provider-address-payload';

interface Props {
  value: ProviderAddressFormValue;
  onChange: (value: ProviderAddressFormValue) => void;
  idPrefix: string;
}

export const ProviderAddressForm: React.FC<Props> = ({ value, onChange, idPrefix }) => {
  const [addressMessage, setAddressMessage] = useState<string | null>(null);
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);

  const selectManualAddress = (suggestion: LocationSuggestion) => {
    if (!suggestion.houseNumber?.trim() || isArtificialHouseNumber(suggestion.houseNumber)) {
      setAddressMessage('Selecione um endereço que contenha um número real.');
      return;
    }
    setAddressMessage(null);
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
        .then((suggestion) => {
          if (!suggestion.houseNumber?.trim() || isArtificialHouseNumber(suggestion.houseNumber)) {
            setAddressMessage('Não foi possível identificar um número real neste endereço. Pesquise o endereço manualmente.');
            return;
          }
          onChange(applyProviderAddressSuggestion(value, suggestion));
        })
        .catch(() => setAddressMessage('Não foi possível identificar o endereço atual. Pesquise o endereço manualmente.'))
        .finally(() => setIsLocatingAddress(false));
    }, () => {
      setAddressMessage('Permita o acesso à localização ou pesquise o endereço manualmente.');
      setIsLocatingAddress(false);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };

  const addressSearchValue = value.address?.formatted || [value.addressLine1, value.houseNumber].filter(Boolean).join(', ');
  const validation = validateProviderAddressForm(value);
  return <div className="space-y-3">
    <LocationAddressField
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
    />
    <div>
      <label className="mazzi-field-label mb-1.5 block" htmlFor={`${idPrefix}-cep`}>CEP *</label>
      <div className="relative">
        <Input id={`${idPrefix}-cep`} inputMode="numeric" maxLength={9} value={maskPostalCode(value.postalCode)} readOnly className="rounded-2xl" />
      </div>
    </div>
    {addressMessage && <p className="text-xs text-rose-700" role="alert">{addressMessage}</p>}
    <div><label className="mazzi-field-label mb-1.5 block" htmlFor={`${idPrefix}-number`}>Número *</label><Input id={`${idPrefix}-number`} value={value.houseNumber} readOnly placeholder="123" className="rounded-2xl" />{isArtificialHouseNumber(value.houseNumber) && <p className="mt-1 text-xs text-rose-700" role="alert">Selecione um endereço com número real.</p>}</div>
    <div><label className="mazzi-field-label mb-1.5 block" htmlFor={`${idPrefix}-complement`}>Complemento (opcional)</label><Input id={`${idPrefix}-complement`} value={value.complement} onChange={(event) => onChange({ ...value, complement: event.target.value })} placeholder="Sala 12, bloco B" className="rounded-2xl" /></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><label className="mazzi-field-label mb-1 block">Bairro</label><Input value={value.neighborhood} readOnly onChange={() => undefined} className="rounded-2xl" /></div><div><label className="mazzi-field-label mb-1 block">Cidade</label><Input value={value.city} readOnly onChange={() => undefined} className="rounded-2xl" /></div><div><label className="mazzi-field-label mb-1 block">UF</label><Input value={value.state} readOnly maxLength={2} onChange={() => undefined} className="rounded-2xl" /></div></div>
    {value.address && validation.valid && <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" /> Endereço localizado: {value.address.formatted || value.address.addressLine1 || 'endereço confirmado'}</div>}
  </div>;
};
