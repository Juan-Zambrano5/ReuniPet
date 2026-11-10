'use client';

import * as React from 'react';
import L from 'leaflet';
import {
  CENTRO_POR_DEFECTO,
  ZOOM_CIUDAD,
  ZOOM_PUNTO,
  crearMapa,
  iconoMarcador,
} from '@/components/mapa/leaflet';
import type {
  MapaSelectorProps,
  PuntoMapa,
} from '@/components/reportes/MapaSelector';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MENSAJE_SIN_UBICACION =
  'No pudimos obtener tu ubicación. Marca el punto en el mapa o escribe la dirección.';

const redondear = (n: number): number => Math.round(n * 1e6) / 1e6;
const aPunto = (p: L.LatLng): PuntoMapa => ({
  lat: redondear(p.lat),
  lng: redondear(p.lng),
});

// HU9: mapa real (Leaflet + OpenStreetMap). Solo se carga en el cliente.
export default function MapaSelectorLeaflet({
  value,
  onChange,
  disabled = false,
}: MapaSelectorProps): React.JSX.Element {
  const contenedorRef = React.useRef<HTMLDivElement>(null);
  const mapaRef = React.useRef<L.Map | null>(null);
  const marcadorRef = React.useRef<L.Marker | null>(null);
  // Los handlers de Leaflet se registran una vez; leen la versión vigente.
  const onChangeRef = React.useRef(onChange);
  const disabledRef = React.useRef(disabled);
  const [sinTeselas, setSinTeselas] = React.useState(false);
  const [buscandoUbicacion, setBuscandoUbicacion] = React.useState(false);
  const [errorUbicacion, setErrorUbicacion] = React.useState(false);
  // Solo se carga en el cliente (ssr:false), así que navigator existe.
  const tieneGeolocalizacion = Boolean(navigator.geolocation);

  React.useEffect(() => {
    onChangeRef.current = onChange;
    disabledRef.current = disabled;
  });

  React.useEffect(() => {
    if (!contenedorRef.current) return;
    const mapa = crearMapa(
      contenedorRef.current,
      value ?? CENTRO_POR_DEFECTO,
      value ? ZOOM_PUNTO : ZOOM_CIUDAD,
      () => setSinTeselas(true),
    );
    mapa.on('click', (e: L.LeafletMouseEvent) => {
      if (!disabledRef.current) onChangeRef.current(aPunto(e.latlng));
    });
    mapaRef.current = mapa;

    return () => {
      mapa.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
    };
    // El mapa se crea una vez; el punto se sincroniza en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lat = value?.lat;
  const lng = value?.lng;
  React.useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    if (lat === undefined || lng === undefined) {
      marcadorRef.current?.remove();
      marcadorRef.current = null;
      return;
    }
    if (marcadorRef.current) {
      marcadorRef.current.setLatLng([lat, lng]);
    } else {
      marcadorRef.current = L.marker([lat, lng], {
        icon: iconoMarcador,
        keyboard: false,
      }).addTo(mapa);
    }
    // Punto que llega del formulario (volver al paso 1, editar): centrarlo.
    if (!mapa.getBounds().contains([lat, lng])) {
      mapa.setView([lat, lng], Math.max(mapa.getZoom(), ZOOM_PUNTO));
    }
  }, [lat, lng]);

  // El permiso solo se pide cuando el usuario pulsa el botón. Centra, no marca.
  function usarMiUbicacion(): void {
    setErrorUbicacion(false);
    setBuscandoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscandoUbicacion(false);
        mapaRef.current?.setView(
          [pos.coords.latitude, pos.coords.longitude],
          ZOOM_PUNTO,
        );
      },
      () => {
        setBuscandoUbicacion(false);
        setErrorUbicacion(true);
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  function manejarTeclado(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const mapa = mapaRef.current;
    if (!mapa || disabled) return;
    onChange(aPunto(mapa.getCenter()));
  }

  return (
    <div>
      <div className="relative isolate mt-3">
        <div
          ref={contenedorRef}
          role="application"
          tabIndex={0}
          aria-label="Mapa: marca la ubicación de la mascota con un clic o con Enter (marca el centro; las flechas mueven el mapa)"
          aria-disabled={disabled || undefined}
          data-testid="mapa-selector"
          onKeyDown={manejarTeclado}
          className={cn(
            'h-64 w-full overflow-hidden rounded-control border border-border bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair',
          )}
        />
      </div>

      {tieneGeolocalizacion && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2"
          disabled={disabled || buscandoUbicacion}
          onClick={usarMiUbicacion}
        >
          {buscandoUbicacion ? 'Buscando tu ubicación...' : 'Usar mi ubicación'}
        </Button>
      )}
      {errorUbicacion && (
        <p role="status" className="mt-2 text-xs text-muted">
          {MENSAJE_SIN_UBICACION}
        </p>
      )}
      {sinTeselas && (
        <p role="status" className="mt-2 text-xs text-muted">
          No se pudo cargar el mapa. Puedes describir la ubicación con texto en
          el formulario.
        </p>
      )}
      <p className="mt-2 text-xs text-muted" data-testid="mapa-coordenadas">
        {value
          ? `Punto marcado: ${value.lat}, ${value.lng}`
          : 'Aún no has marcado un punto. Toca el mapa o describe la ubicación con texto.'}
      </p>
    </div>
  );
}
