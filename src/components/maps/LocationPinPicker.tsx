import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Button } from '../ui/Button';
import { LocateFixed, MapPin } from 'lucide-react';

interface LocationPinPickerProps {
  latitude?: number;
  longitude?: number;
  onConfirm: (latitude: number, longitude: number) => void;
  onLocate?: (latitude: number, longitude: number) => void;
}

const FALLBACK: L.LatLngExpression = [-23.5505, -46.6333];

export const LocationPinPicker: React.FC<LocationPinPickerProps> = ({ latitude, longitude, onConfirm, onLocate }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const selectedRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const setPin = (lat: number, lng: number) => {
    const position = { latitude: lat, longitude: lng };
    selectedRef.current = position;
    setSelectedPosition(position);
    setLocationError(null);
    markerRef.current?.setLatLng([lat, lng]);
  };

  useEffect(() => {
    if (!elementRef.current) return;
    const initial: [number, number] = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [latitude as number, longitude as number] : FALLBACK as [number, number];
    const map = L.map(elementRef.current, { center: initial, zoom: 15, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    const marker = L.marker(initial, { draggable: true }).addTo(map);
    marker.on('dragend', () => { const pos = marker.getLatLng(); setPin(pos.lat, pos.lng); });
    map.on('click', (event) => setPin(event.latlng.lat, event.latlng.lng));
    mapRef.current = map;
    markerRef.current = marker;
    const initialPosition = Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude: latitude as number, longitude: longitude as number } : null;
    selectedRef.current = initialPosition;
    setSelectedPosition(initialPosition);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('A localização do dispositivo não está disponível. Escolha o ponto no mapa.');
      return;
    }
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setPin(coords.latitude, coords.longitude);
      mapRef.current?.setView([coords.latitude, coords.longitude], 16, { animate: true });
      onLocate?.(coords.latitude, coords.longitude);
    }, () => {
      setLocationError('Não foi possível obter sua localização. Confirme a permissão ou escolha o ponto no mapa.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };

  return <div className="space-y-3">
    <div ref={elementRef} className="h-64 overflow-hidden rounded-2xl border border-[var(--mazzi-border)]" aria-label="Mapa para confirmar localização" />
    <div className="grid min-w-0 grid-cols-2 gap-2">
      <Button type="button" variant="outline" size="sm" className="min-w-0 px-2 text-[11px]" leftIcon={<LocateFixed className="h-3.5 w-3.5 shrink-0" />} onClick={useCurrentLocation}><span className="truncate">Minha localização</span></Button>
      <Button type="button" variant="primary" size="sm" className="min-w-0 px-2 text-[11px]" leftIcon={<MapPin className="h-3.5 w-3.5 shrink-0" />} disabled={!selectedPosition} onClick={() => { if (selectedPosition) onConfirm(selectedPosition.latitude, selectedPosition.longitude); }}><span className="truncate">Confirmar ponto</span></Button>
    </div>
    {locationError && <p className="px-1 text-[11px] leading-relaxed text-rose-700" role="alert">{locationError}</p>}
  </div>;
};
