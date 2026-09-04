import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Provider } from '../../types';
import { PROVIDER_COORDINATES } from './MazziMap';
import { formatCentsToBRL } from '../../domain/money';
import { LocateFixed } from 'lucide-react';
import { getActiveMapTileProvider } from '../../domain/maps/map-tile-provider';

// Default center in São Paulo (Pinheiros / Av. Paulista region)
const DEFAULT_CENTER: [number, number] = [-23.5615, -46.6914];

function validCoordinates(point?: { lat: number; lng: number } | null): boolean {
  return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

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
  providerMarker?: 'initials' | 'vehicle';
  followSelectedProvider?: boolean;
  interactive?: boolean;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  providers = [],
  selectedProvider = null,
  onSelectProvider,
  className = '',
  height = '360px',
  showCoverageRadius = false,
  meetingPoint: rawMeetingPoint,
  userLocation: rawUserLocation,
  searchedLocation: rawSearchedLocation,
  zoom = 13,
  providerMarker = 'initials',
  followSelectedProvider = false,
  interactive = true,
}) => {
  const meetingPoint = validCoordinates(rawMeetingPoint) ? rawMeetingPoint : undefined;
  const userLocation = validCoordinates(rawUserLocation) ? rawUserLocation : undefined;
  const searchedLocation = validCoordinates(rawSearchedLocation) ? rawSearchedLocation : undefined;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const followingRef = useRef(true);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initialCenter = meetingPoint
      ? [meetingPoint.lat, meetingPoint.lng] as [number, number]
      : selectedProvider && validCoordinates(PROVIDER_COORDINATES[selectedProvider.id])
      ? [PROVIDER_COORDINATES[selectedProvider.id].lat, PROVIDER_COORDINATES[selectedProvider.id].lng] as [number, number]
      : DEFAULT_CENTER;

    const map = L.map(mapContainerRef.current, {
      zoomControl: interactive,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive ? 'center' : false,
      doubleClickZoom: interactive,
      attributionControl: true,
    });

    // Own the instance before initializing its view/layers so failures can be cleaned up.
    mapInstanceRef.current = map;
    const dispose = () => {
      map.remove();
      if (mapInstanceRef.current === map) {
        mapInstanceRef.current = null;
        markersGroupRef.current = null;
      }
    };
    try {
    map.setView(initialCenter, Number.isFinite(zoom) ? zoom : 13, { animate: false });
    const tileProvider = getActiveMapTileProvider();
    L.tileLayer(tileProvider.urlTemplate, {
      maxZoom: tileProvider.maxZoom,
      attribution: tileProvider.attribution,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;
    const pauseFollowing = () => { followingRef.current = false; };
    map.on('dragstart zoomstart', pauseFollowing);

    } catch (error) {
      dispose();
      throw error;
    }
    return dispose;
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
        html: followSelectedProvider ? '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>' : `
          <div style="background: #020617; border: 2px solid #FFC700; color: #FFFFFF; border-radius: 9999px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-weight: 900; font-size: 11px;">
            📍
          </div>
        `,
        iconSize: followSelectedProvider ? [28, 28] : [36, 36],
        iconAnchor: followSelectedProvider ? [14, 27] : [18, 18],
      });

      const m = L.marker([meetingPoint.lat, meetingPoint.lng], { icon: meetingIcon, title: 'Local do aluno', alt: 'Local do aluno' }).addTo(group);
      if (!followSelectedProvider) m.bindPopup(`
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
      if (!validCoordinates(pos)) return;
      const isSelected = selectedProvider?.id === prov.id;
      const initials = prov.name.split(' ').map((n) => n[0]).slice(0, 2).join('');
      const vehicleIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${prov.categories[0] === 'A'
        ? '<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-8h5l4 8M10 9l4 8H5M14 5h3l2 4M7 9h4"/>'
        : '<path d="m5 7-3 6v6h3v-3h14v3h3v-6l-3-6H5Z"/><path d="M2 13h20M7 7l1-3h8l1 3M6 16h1M17 16h1"/>'}</svg>`;

      const customIcon = L.divIcon({
        className: 'custom-mazzi-marker',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="background: ${isSelected ? '#FFC700' : '#020617'}; border: 2px solid ${isSelected ? '#020617' : '#FFC700'}; color: ${isSelected ? '#020617' : '#FFFFFF'}; border-radius: 14px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.25); font-weight: 900; font-size: 11px;">
              ${providerMarker === 'vehicle' ? vehicleIcon : initials}
            </div>
            ${providerMarker !== 'vehicle' ? `<div style="background: #020617; color: #FFC700; font-weight: 800; font-size: 9px; padding: 2px 6px; border-radius: 8px; margin-top: -6px; border: 1px solid #334155; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
              ${formatCentsToBRL(prov.startingPriceInCents)}
            </div>` : ''}
          </div>
        `,
        iconSize: providerMarker === 'vehicle' ? [34, 34] : [44, 46],
        iconAnchor: providerMarker === 'vehicle' ? [17, 17] : [22, 23],
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
            ${onSelectProvider ? `<button id="leaflet-btn-${prov.id}" style="background: #FFC700; color: #020617; border: none; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 800; cursor: pointer;">
              Ver Horários
            </button>` : ''}
          </div>
        </div>
      `;

      if (providerMarker !== 'vehicle') marker.bindPopup(popupContent);

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

    if (followSelectedProvider) {
      if (followingRef.current && selectedProvider && validCoordinates({ lat: selectedProvider.latitude!, lng: selectedProvider.longitude! })) {
        map.setView([selectedProvider.latitude, selectedProvider.longitude], zoom, { animate: false });
        followingRef.current = true;
      }
    } else if (providers.length > 0) {
      const providerBounds = providers.map((prov) => {
        const configured = prov.latitude != null && prov.longitude != null
          ? [prov.latitude, prov.longitude] as [number, number]
          : PROVIDER_COORDINATES[prov.id]
            ? [PROVIDER_COORDINATES[prov.id].lat, PROVIDER_COORDINATES[prov.id].lng] as [number, number]
            : DEFAULT_CENTER;
        return configured;
      }).filter(([lat, lng]) => validCoordinates({ lat, lng }));
      if (searchedLocation) providerBounds.push([searchedLocation.lat, searchedLocation.lng]);
      if (userLocation) providerBounds.push([userLocation.lat, userLocation.lng]);
      if (meetingPoint) providerBounds.push([meetingPoint.lat, meetingPoint.lng]);
      const bounds = L.latLngBounds(providerBounds);
      if (providerBounds.length > 0) map.fitBounds(bounds, { padding: [32, 32], maxZoom: zoom });
    }

    if (userLocation) {
      const userIcon = L.divIcon({ className: 'custom-mazzi-user-marker', html: '<div style="background:#2563EB;border:3px solid #fff;border-radius:9999px;width:18px;height:18px"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(group).bindPopup('Sua localização');
    }
    if (searchedLocation && (!userLocation || searchedLocation.lat !== userLocation.lat || searchedLocation.lng !== userLocation.lng)) {
      const searchIcon = L.divIcon({ className: 'custom-mazzi-search-marker', html: '<div style="background:#DC2626;border:3px solid #fff;border-radius:9999px 9999px 9999px 0;width:20px;height:20px;transform:rotate(-45deg)"></div>', iconSize: [20, 20], iconAnchor: [4, 18] });
      L.marker([searchedLocation.lat, searchedLocation.lng], { icon: searchIcon }).addTo(group).bindPopup(searchedLocation.label || 'Endereço pesquisado');
    }
  }, [providers, selectedProvider, showCoverageRadius, meetingPoint, userLocation, searchedLocation, zoom, providerMarker, onSelectProvider, followSelectedProvider]);

  return (
    <div
      className={`w-full rounded-3xl overflow-hidden border border-slate-200 shadow-sm relative z-0 ${className}`}
      style={{ height }}
    >
      <div ref={mapContainerRef} className="absolute inset-0" />
      {followSelectedProvider && interactive && (
        <button
          type="button"
          aria-label="Voltar ao profissional"
          title="Voltar ao profissional"
          disabled={!selectedProvider || !validCoordinates({ lat: selectedProvider.latitude!, lng: selectedProvider.longitude! })}
          onClick={() => {
            if (!selectedProvider || !validCoordinates({ lat: selectedProvider.latitude!, lng: selectedProvider.longitude! })) return;
            mapInstanceRef.current?.setView([selectedProvider.latitude, selectedProvider.longitude], zoom, { animate: false });
            followingRef.current = true;
          }}
          className="absolute bottom-4 left-4 z-[1000] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-[var(--mazzi-dark)] shadow-md hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-50"
        >
          <LocateFixed className="h-6 w-6" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
