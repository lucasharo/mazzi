import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Provider } from '../../types';
import { PROVIDER_COORDINATES } from './MazziMap';
import { formatCentsToBRL } from '../../domain/money';

// Default center in São Paulo (Pinheiros / Av. Paulista region)
const DEFAULT_CENTER: [number, number] = [-23.5615, -46.6914];

export interface LeafletMapProps {
  providers?: Provider[];
  selectedProvider?: Provider | null;
  onSelectProvider?: (provider: Provider) => void;
  className?: string;
  height?: string;
  showCoverageRadius?: boolean;
  meetingPoint?: { lat: number; lng: number; title: string };
  userLocation?: { lat: number; lng: number };
  searchedLocation?: { lat: number; lng: number; label?: string };
  zoom?: number;
  interactive?: boolean;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  providers = [],
  selectedProvider = null,
  onSelectProvider,
  className = '',
  height = '360px',
  showCoverageRadius = false,
  meetingPoint,
  userLocation,
  searchedLocation,
  zoom = 13,
  interactive = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initialCenter = meetingPoint
      ? [meetingPoint.lat, meetingPoint.lng] as [number, number]
      : selectedProvider && PROVIDER_COORDINATES[selectedProvider.id]
      ? [PROVIDER_COORDINATES[selectedProvider.id].lat, PROVIDER_COORDINATES[selectedProvider.id].lng] as [number, number]
      : DEFAULT_CENTER;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive ? 'center' : false,
      doubleClickZoom: interactive,
      attributionControl: false,
    });

    // High clarity CartoDB Positron tiles for clean modern mobility look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers and layers when providers or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // Meeting Point Marker if provided
    if (meetingPoint) {
      const meetingIcon = L.divIcon({
        className: 'custom-mazzi-marker',
        html: `
          <div style="background: #020617; border: 2px solid #FFC700; color: #FFFFFF; border-radius: 9999px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-weight: 900; font-size: 11px;">
            📍
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const m = L.marker([meetingPoint.lat, meetingPoint.lng], { icon: meetingIcon }).addTo(group);
      m.bindPopup(`
        <div style="padding: 6px; font-family: system-ui, -apple-system, sans-serif;">
          <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #D97706; display: block;">Ponto de Encontro da Aula</span>
          <strong style="font-size: 13px; color: #020617; display: block; margin-top: 2px;">${meetingPoint.title}</strong>
        </div>
      `).openPopup();
    }

    // Provider Markers
    providers.forEach((prov) => {
      const configured = prov.latitude != null && prov.longitude != null
        ? { lat: prov.latitude, lng: prov.longitude }
        : PROVIDER_COORDINATES[prov.id];
      const pos = configured || { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
      const isSelected = selectedProvider?.id === prov.id;
      const initials = prov.name.split(' ').map((n) => n[0]).slice(0, 2).join('');

      const customIcon = L.divIcon({
        className: 'custom-mazzi-marker',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="background: ${isSelected ? '#FFC700' : '#020617'}; border: 2px solid ${isSelected ? '#020617' : '#FFC700'}; color: ${isSelected ? '#020617' : '#FFFFFF'}; border-radius: 14px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.25); font-weight: 900; font-size: 11px;">
              ${initials}
            </div>
            <div style="background: #020617; color: #FFC700; font-weight: 800; font-size: 9px; padding: 2px 6px; border-radius: 8px; margin-top: -6px; border: 1px solid #334155; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
              ${formatCentsToBRL(prov.startingPriceInCents)}
            </div>
          </div>
        `,
        iconSize: [44, 46],
        iconAnchor: [22, 23],
      });

      const marker = L.marker([pos.lat, pos.lng], { icon: customIcon }).addTo(group);

      if (showCoverageRadius) {
        L.circle([pos.lat, pos.lng], {
          color: '#FFC700',
          fillColor: '#FFC700',
          fillOpacity: 0.12,
          radius: 2200, // 2.2 km coverage radius
          weight: 1.5,
          dashArray: '4, 4',
        }).addTo(group);
      }

      // Popup
      const popupContent = `
        <div style="padding: 6px 4px; font-family: system-ui, -apple-system, sans-serif; min-width: 180px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; background: #FEF3C7; color: #92400E; padding: 2px 6px; border-radius: 6px;">
              ${prov.type === 'DRIVING_SCHOOL' ? 'CFC / Autoescola' : 'Instrutor'}
            </span>
            <span style="font-size: 11px; font-weight: 800; color: #D97706;">★ ${prov.ratingAverage.toFixed(1)}</span>
          </div>
          <strong style="font-size: 13px; color: #020617; display: block; margin-top: 4px;">${prov.name}</strong>
          <span style="font-size: 11px; color: #64748B; display: block; margin-top: 1px;">📍 ${prov.neighborhood}, São Paulo</span>
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #F1F5F9; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 12px; font-weight: 900; color: #020617;">${formatCentsToBRL(prov.startingPriceInCents)}<span style="font-size: 9px; color: #94A3B8; font-weight: 500;"> / 50min</span></span>
            <button id="leaflet-btn-${prov.id}" style="background: #FFC700; color: #020617; border: none; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 800; cursor: pointer;">
              Ver Horários
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`leaflet-btn-${prov.id}`);
        if (btn && onSelectProvider) {
          btn.onclick = () => onSelectProvider(prov);
        }
      });

      marker.on('click', () => {
        if (onSelectProvider) onSelectProvider(prov);
      });
    });

    if (providers.length > 0) {
      const providerBounds = providers.map((prov) => {
        const configured = prov.latitude != null && prov.longitude != null
          ? [prov.latitude, prov.longitude] as [number, number]
          : PROVIDER_COORDINATES[prov.id]
            ? [PROVIDER_COORDINATES[prov.id].lat, PROVIDER_COORDINATES[prov.id].lng] as [number, number]
            : DEFAULT_CENTER;
        return configured;
      });
      if (searchedLocation) providerBounds.push([searchedLocation.lat, searchedLocation.lng]);
      if (userLocation) providerBounds.push([userLocation.lat, userLocation.lng]);
      const bounds = L.latLngBounds(providerBounds);
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
    }

    if (userLocation) {
      const userIcon = L.divIcon({ className: 'custom-mazzi-user-marker', html: '<div style="background:#2563EB;border:3px solid #fff;border-radius:9999px;width:18px;height:18px;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(group).bindPopup('Sua localização');
    }
    if (searchedLocation && (!userLocation || searchedLocation.lat !== userLocation.lat || searchedLocation.lng !== userLocation.lng)) {
      const searchIcon = L.divIcon({ className: 'custom-mazzi-search-marker', html: '<div style="background:#DC2626;border:3px solid #fff;border-radius:9999px 9999px 9999px 0;width:20px;height:20px;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>', iconSize: [20, 20], iconAnchor: [4, 18] });
      L.marker([searchedLocation.lat, searchedLocation.lng], { icon: searchIcon }).addTo(group).bindPopup(searchedLocation.label || 'Endereço pesquisado');
    }
  }, [providers, selectedProvider, showCoverageRadius, meetingPoint, userLocation, searchedLocation]);

  return (
    <div
      ref={mapContainerRef}
      className={`w-full rounded-3xl overflow-hidden border border-slate-200 shadow-sm relative z-0 ${className}`}
      style={{ height }}
    />
  );
};
