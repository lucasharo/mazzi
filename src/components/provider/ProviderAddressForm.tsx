import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { LocationAddressField } from '../search/LocationAddressField';
import { ToastContainer, ToastMessage } from '../ui/Toast';
import { maskPostalCode } from '../../domain/maps/awesomeapi-cep';
import { activeGeocodingProvider, LocationSuggestion } from '../../domain/maps/geocoding-provider';
import { applyProviderAddressSuggestion, isArtificialHouseNumber, ProviderAddressFormValue } from '../../domain/maps/provider-address-payload';
import { getCurrentPositionCompat } from '../../lib/native-platform';

export type { ProviderAddressFormValue } from '../../domain/maps/provider-address-payload';

interface Props {
  value: ProviderAddressFormValue;
  onChange: (value: ProviderAddressFormValue) => void;
  idPrefix: string;
}

export const ProviderAddressForm: React.FC<Props> = ({ value, onChange, idPrefix }) => {
  const [addressToasts, setAddressToasts] = useState<ToastMessage[]>([]);
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);

  const showAddressError = (description: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setAddressToasts((current) => [...current, { id, type: 'error', title: 'Endereço inválido', description }]);
    window.setTimeout(() => setAddressToasts((current) => current.filter((toast) => toast.id !== id)), 5000);
  };

  const clearAddressToasts = () => setAddressToasts([]);

  const selectManualAddress = (suggestion: LocationSuggestion) => {
    if (!suggestion.houseNumber?.trim() || isArtificialHouseNumber(suggestion.houseNumber)) {
      showAddressError('Selecione um endereço que contenha um número real.');
      return;
    }
    clearAddressToasts();
    onChange(applyProviderAddressSuggestion(value, suggestion));
  };

  const useCurrentAddress = () => {
    if (isLocatingAddress) {
      showAddressError('A localização do dispositivo não está disponível. Pesquise o endereço manualmente.');
      return;
    }
    setIsLocatingAddress(true);
    clearAddressToasts();
    void getCurrentPositionCompat({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }).then(({ coords }) => {
      void activeGeocodingProvider.reverseGeocode(coords.latitude, coords.longitude)
        .then((suggestion) => {
          if (!suggestion.houseNumber?.trim() || isArtificialHouseNumber(suggestion.houseNumber)) {
            showAddressError('Não foi possível identificar um número real neste endereço. Pesquise o endereço manualmente.');
            return;
          }
          clearAddressToasts();
          onChange(applyProviderAddressSuggestion(value, suggestion));
        })
        .catch(() => showAddressError('Não foi possível identificar o endereço atual. Pesquise o endereço manualmente.'))
        .finally(() => setIsLocatingAddress(false));
    }, () => {
      showAddressError('Permita o acesso à localização ou pesquise o endereço manualmente.');
      setIsLocatingAddress(false);
    });
  };

  const addressSearchValue = value.address?.formatted || [value.addressLine1, value.houseNumber].filter(Boolean).join(', ');
  return <>
    <ToastContainer toasts={addressToasts} onDismiss={(id) => setAddressToasts((current) => current.filter((toast) => toast.id !== id))} />
    <div className="space-y-3">
      <LocationAddressField
        id={`${idPrefix}-street`}
        value={addressSearchValue}
        ariaLabel="Buscar endereço operacional"
        onChange={() => { /* The confirmed suggestion is applied atomically below. */ }}
        onClear={() => { clearAddressToasts(); onChange({ ...value, addressLine1: '', houseNumber: '', neighborhood: '', city: '', state: '', postalCode: '', address: undefined }); }}
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
      <div><label className="mazzi-field-label mb-1.5 block" htmlFor={`${idPrefix}-number`}>Número *</label><Input id={`${idPrefix}-number`} value={value.houseNumber} readOnly placeholder="123" className="rounded-2xl" />{isArtificialHouseNumber(value.houseNumber) && <p className="mt-1 text-xs text-rose-700" role="alert">Selecione um endereço com número real.</p>}</div>
      <div><label className="mazzi-field-label mb-1.5 block" htmlFor={`${idPrefix}-complement`}>Complemento (opcional)</label><Input id={`${idPrefix}-complement`} value={value.complement} onChange={(event) => onChange({ ...value, complement: event.target.value })} placeholder="Sala 12, bloco B" className="rounded-2xl" /></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><label className="mazzi-field-label mb-1 block">Bairro</label><Input value={value.neighborhood} readOnly onChange={() => undefined} className="rounded-2xl" /></div><div><label className="mazzi-field-label mb-1 block">Cidade</label><Input value={value.city} readOnly onChange={() => undefined} className="rounded-2xl" /></div><div><label className="mazzi-field-label mb-1 block">UF</label><Input value={value.state} readOnly maxLength={2} onChange={() => undefined} className="rounded-2xl" /></div></div>
    </div>
  </>;
};
