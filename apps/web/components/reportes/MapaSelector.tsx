'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

export interface PuntoMapa {
  lat: number;
  lng: number;
}

export interface MapaSelectorProps {
  value: PuntoMapa | null;
  onChange: (punto: PuntoMapa) => void;
  disabled?: boolean;
}

function MapaCargando(): React.JSX.Element {
  return (
    <div
      className="mt-3 flex h-64 items-center justify-center rounded-control border border-border bg-surface text-xs text-muted"
      data-testid="mapa-cargando"
    >
      Cargando mapa...
    </div>
  );
}

function MapaNoDisponible(): React.JSX.Element {
  return (
    <p role="status" className="mt-3 text-xs text-muted">
      No se pudo cargar el mapa. Puedes describir la ubicación con texto en el
      formulario.
    </p>
  );
}

// HU9: Leaflet usa window, así que solo se carga en el cliente. Si el
// módulo no llega (sin conexión), el formulario sigue funcionando sin mapa.
const MapaLeaflet = dynamic<MapaSelectorProps>(
  () =>
    import('@/components/reportes/MapaSelectorLeaflet').catch(
      () => MapaNoDisponible,
    ),
  { ssr: false, loading: MapaCargando },
);

export function MapaSelector(props: MapaSelectorProps): React.JSX.Element {
  return <MapaLeaflet {...props} />;
}
