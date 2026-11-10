'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

export interface MapaUbicacionProps {
  lat: number;
  lng: number;
  /** true: marcador en el punto exacto (dueño). false: círculo de ~1 km. */
  exacto: boolean;
}

function MapaCargando(): React.JSX.Element {
  return (
    <div className="flex h-64 items-center justify-center rounded-control border border-border bg-surface text-xs text-muted">
      Cargando mapa...
    </div>
  );
}

// Leaflet usa window: solo en el cliente. Si el módulo no llega, no hay mapa
// y queda la ubicación escrita.
const MapaLeaflet = dynamic<MapaUbicacionProps>(
  () =>
    import('@/components/reportes/MapaUbicacionLeaflet').catch(
      () => () => null,
    ),
  { ssr: false, loading: MapaCargando },
);

export function MapaUbicacion(props: MapaUbicacionProps): React.JSX.Element {
  return <MapaLeaflet {...props} />;
}
