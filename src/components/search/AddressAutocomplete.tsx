import React, { useEffect, useId, useRef, useState } from 'react';
import { LoaderCircle, MapPin, X } from 'lucide-react';
import { activeGeocodingProvider, LocationSuggestion } from '../../domain/maps/geocoding-provider';
import { ButtonBase } from '../ui/Button';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: LocationSuggestion) => void;
  onClear?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
  proximity?: { longitude: number; latitude: number };
  dropdownAlignment?: 'input' | 'viewport';
  onFocus?: () => void;
  onBlur?: () => void;
}

const cache = new Map<string, { expiresAt: number; results: LocationSuggestion[] }>();

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  onClear,
  placeholder = 'Digite um endereço, bairro ou local',
  ariaLabel = 'Buscar endereço ou local',
  className = '',
  inputClassName = '',
  proximity,
  dropdownAlignment = 'input',
  onFocus,
  onBlur,
}) => {
  const listboxId = useId();
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const skipNextLookupRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [viewportDropdownTop, setViewportDropdownTop] = useState<number | null>(null);

  useEffect(() => {
    if (dropdownAlignment !== 'viewport' || !suggestions.length) return;

    const updatePosition = () => {
      const bounds = inputRef.current?.getBoundingClientRect();
      setViewportDropdownTop(bounds ? bounds.bottom + 8 : null);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [dropdownAlignment, suggestions.length]);

  useEffect(() => {
    const query = value.trim();
    abortRef.current?.abort();
    if (!hasUserEditedRef.current) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    if (skipNextLookupRef.current) {
      skipNextLookupRef.current = false;
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    if (query.length < 3 || !activeGeocodingProvider.autocomplete) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cacheKey = `${query.toLowerCase()}|${proximity?.longitude ?? ''},${proximity?.latitude ?? ''}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setSuggestions(cached.results);
      setActiveIndex(-1);
      return;
    }

    const requestId = ++requestRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await activeGeocodingProvider.autocomplete!(query, { limit: 6, signal: controller.signal, proximity });
        if (requestId !== requestRef.current) return;
        cache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, results });
        setSuggestions(results);
        setActiveIndex(-1);
      } catch (err) {
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        setSuggestions([]);
        setError(err instanceof Error && err.message === 'GEOAPIFY_RATE_LIMIT'
          ? 'Busca temporariamente limitada. Tente novamente em instantes.'
          : 'Não foi possível buscar endereços agora. Tente novamente.');
      } finally {
        if (requestId === requestRef.current) setIsLoading(false);
      }
    }, 325);
    return () => window.clearTimeout(timer);
  }, [value, proximity?.latitude, proximity?.longitude]);

  const selectSuggestion = (suggestion: LocationSuggestion) => {
    skipNextLookupRef.current = true;
    abortRef.current?.abort();
    onChange(suggestion.formattedAddress);
    onSelect(suggestion);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const clearInput = () => {
    abortRef.current?.abort();
    setSuggestions([]);
    setActiveIndex(-1);
    setError(null);
    onChange('');
    onClear?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={suggestions.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          value={value}
          onChange={(event) => {
            hasUserEditedRef.current = true;
            onChange(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`w-full ${inputClassName}`}
          autoComplete="off"
        />
        {isLoading && <LoaderCircle className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--mazzi-muted)]" aria-label="Buscando endereços" />}
        {!isLoading && value.trim() && <ButtonBase type="button" onClick={clearInput} aria-label="Limpar localização" title="Limpar localização" className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[var(--mazzi-muted)] transition hover:bg-slate-100 hover:text-[var(--mazzi-dark)]"><X className="h-4 w-4" aria-hidden="true" /></ButtonBase>}
      </div>
      {error && <p className="mt-1 text-xs text-rose-700" role="alert">{error}</p>}
      {suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          style={dropdownAlignment === 'viewport' && viewportDropdownTop !== null ? { top: viewportDropdownTop } : undefined}
          className={`${dropdownAlignment === 'viewport' ? 'fixed left-1/2' : 'absolute left-1/2 mt-2'} z-50 max-h-72 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-2xl border border-[var(--mazzi-border)] bg-white p-1 shadow-[0_14px_32px_rgba(16,24,40,0.14)]`}
        >
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.placeId || suggestion.formattedAddress}-${index}`} id={`${listboxId}-${index}`} role="option" aria-selected={index === activeIndex}>
              <ButtonBase type="button" className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-3 text-left transition ${index === activeIndex ? 'bg-amber-50' : 'hover:bg-amber-50'}`} onMouseDown={(event) => event.preventDefault()} onClick={() => selectSuggestion(suggestion)}>
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-50 text-[var(--mazzi-yellow-dark)]"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold leading-4 text-[var(--mazzi-text)]">{suggestion.addressLine1 || suggestion.formattedAddress}</span><span className="mt-0.5 block truncate text-[10px] font-medium leading-4 text-[var(--mazzi-muted)]">{suggestion.addressLine2 || suggestion.formattedAddress}</span></span>
              </ButtonBase>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
