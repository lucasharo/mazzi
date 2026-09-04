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
  meetingPoint?: MapMeetingPoint;
  userLocation?: MapCoordinates;
  searchedLocation?: MapCoordinates & { label?: string };
  zoom?: number;
  providerMarker?: 'initials' | 'vehicle';
  followSelectedProvider?: boolean;
  interactive?: boolean;
}

/**
 * Interface representing any map rendering engine in the MAZZI architecture.
 * [DECISÃO]: OpenStreetMap + Leaflet is the official initial map provider for MVP.
 * Presentation layer only — all spatial distances and rankings belong to PostgreSQL + PostGIS backend.
 */
export type MapProviderComponent = React.FC<MapProviderProps>;
