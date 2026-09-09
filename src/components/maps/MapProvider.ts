import React from 'react';
import { Provider } from '../../types';

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface MapMeetingPoint {
  lat: number;
  lng: number;
  title: string;
}

export interface MapProviderProps {
  providers?: Provider[];
  selectedProvider?: Provider | null;
  onSelectProvider?: (provider: Provider) => void;
  className?: string;
  height?: string;
  showCoverageRadius?: boolean;
  showMeetingPointPopup?: boolean;
  meetingPoint?: MapMeetingPoint;
  /** Centers the map without rendering a meeting-point marker. */
  mapCenter?: MapCoordinates;
  userLocation?: MapCoordinates;
  searchedLocation?: MapCoordinates & { label?: string };
  zoom?: number;
  providerMarker?: 'initials' | 'vehicle';
  followSelectedProvider?: boolean;
  /** Enables map gestures, controls and marker interactions. */
  interactive?: boolean;
  /** Called once the map engine has initialized and is ready to be shown. */
  onReady?: () => void;
}

/**
 * Interface representing any map rendering engine in the MAZZI architecture.
 * [DECISÃO]: OpenStreetMap + Leaflet is the official initial map provider for MVP.
 * Presentation layer only — all spatial distances and rankings belong to PostgreSQL + PostGIS backend.
 */
export type MapProviderComponent = React.FC<MapProviderProps>;
