import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { Input } from '../ui/Input';
import { ButtonBase } from '../ui/Button';
import { AddressAutocomplete } from '../search/AddressAutocomplete';
import { awesomeApiCepProvider, maskPostalCode, normalizePostalCode, BrazilianPostalAddress } from '../../domain/maps/awesomeapi-cep';
import { LocationSuggestion } from '../../domain/maps/geocoding-provider';
import { ProviderAddress } from '../../types';

export interface ProviderAddressFormValue {
  addressLine1: string;
  houseNumber: string;
  complement: string;
  postalCode: string;
  neighborhood: string;
  city: string;
  state: string;
  address?: ProviderAddress;
}

interface Props {
  value: ProviderAddressFormValue;
  onChange: (value: ProviderAddressFormValue) => void;
  idPrefix: string;
}

function applyCep(value: ProviderAddressFormValue, cep: BrazilianPostalAddress): ProviderAddressFormValue {
  return { ...value, postalCode: maskPostalCode(cep.postalCode), addressLine1: cep.street, neighborhood: cep.neighborhood, city: cep.city, state: cep.stateCode, address: undefined };
}

export const ProviderAddressForm: React.FC<Props> = ({ value, onChange, idPrefix }) => {
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

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
    onChange({ ...value, addressLine1: suggestion.street || suggestion.addressLine1 || suggestion.formattedAddress, neighborhood: suggestion.neighborhood, city: suggestion.city, state: suggestion.stateCode || suggestion.state, postalCode: maskPostalCode(suggestion.postalCode || value.postalCode), address: { formatted: suggestion.formattedAddress, addressLine1: suggestion.addressLine1, addressLine2: suggestion.addressLine2, street: suggestion.street, houseNumber: suggestion.houseNumber, neighborhood: suggestion.neighborhood, city: suggestion.city, state: suggestion.state, stateCode: suggestion.stateCode, postalCode: suggestion.postalCode, country: suggestion.country, countryCode: suggestion.countryCode, latitude: suggestion.latitude, longitude: suggestion.longitude, placeId: suggestion.placeId, source: 'GEOAPIFY' } });
    setManualSearch(false);
  };

  return <fieldset className="space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-slate-50/60 p-4">
    <legend className="px-1 text-sm font-bold text-[var(--mazzi-dark)]">Endereço operacional</legend>
    <div>
      <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor={`${idPrefix}-cep`}>CEP *</label>
      <div className="relative">
        <Input id={`${idPrefix}-cep`} inputMode="numeric" maxLength={9} value={maskPostalCode(value.postalCode)} onChange={(event) => onChange({ ...value, postalCode: maskPostalCode(event.target.value), address: undefined })} placeholder="00000-000" className="rounded-2xl pr-10" />
        {isLookingUpCep && <LoaderCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--mazzi-muted)]" aria-label="Consultando CEP" />}
      </div>
      {cepMessage && <p className="mt-1 text-xs text-rose-700" role="alert">{cepMessage}</p>}
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
      <div><label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor={`${idPrefix}-street`}>Logradouro *</label><Input id={`${idPrefix}-street`} value={value.addressLine1} readOnly={normalizePostalCode(value.postalCode).length === 8 && !manualSearch} onChange={(event) => onChange({ ...value, addressLine1: event.target.value, address: undefined })} className="rounded-2xl" /></div>
      <div><label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor={`${idPrefix}-number`}>Número *</label><Input id={`${idPrefix}-number`} value={value.houseNumber} onChange={(event) => onChange({ ...value, houseNumber: event.target.value, address: undefined })} placeholder="123" className="rounded-2xl" /></div>
    </div>
    <div><label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor={`${idPrefix}-complement`}>Complemento (opcional)</label><Input id={`${idPrefix}-complement`} value={value.complement} onChange={(event) => onChange({ ...value, complement: event.target.value })} placeholder="Sala 12, bloco B" className="rounded-2xl" /></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><label className="mb-1 block text-xs font-bold text-slate-700">Bairro</label><Input value={value.neighborhood} readOnly={!manualSearch} onChange={(event) => onChange({ ...value, neighborhood: event.target.value, address: undefined })} className="rounded-2xl" /></div><div><label className="mb-1 block text-xs font-bold text-slate-700">Cidade</label><Input value={value.city} readOnly={!manualSearch} onChange={(event) => onChange({ ...value, city: event.target.value, address: undefined })} className="rounded-2xl" /></div><div><label className="mb-1 block text-xs font-bold text-slate-700">UF</label><Input value={value.state} readOnly={!manualSearch} maxLength={2} onChange={(event) => onChange({ ...value, state: event.target.value.toUpperCase(), address: undefined })} className="rounded-2xl" /></div></div>
    {value.address?.source === 'GEOAPIFY' ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" /> Endereço localizado: {value.address.formatted}</div> : <ButtonBase type="button" className="text-left text-xs font-bold text-[var(--mazzi-dark)] underline" onClick={() => setManualSearch(true)}>Buscar endereço manualmente</ButtonBase>}
    {manualSearch && <AddressAutocomplete value={value.addressLine1} ariaLabel="Buscar endereço manualmente" onChange={(addressLine1) => onChange({ ...value, addressLine1, address: undefined })} onSelect={selectManualAddress} inputClassName="min-h-11 rounded-2xl border border-[var(--mazzi-border)] px-3.5 py-2.5 text-sm" />}
  </fieldset>;
};
