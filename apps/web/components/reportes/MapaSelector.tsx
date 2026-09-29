'use client';

import * as React from 'react';
import { MapPin } from 'lucide-react';

export interface PuntoMapa {
  lat: number;
  lng: number;
}

/**
 * HU9: mapa mock clicable (sin SDK de mapas). El clic se traduce a un
 * punto dentro de un bounding box simulado, determinista y testeable.
 */
const BBOX = {
  latMin: 10.4,
  latMax: 10.5,
  lngMin: -66.95,
  lngMax: -66.85,
};

const REDONDEO = 1e5;

function puntoDesdeClic(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): PuntoMapa {
  const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
  const lat = BBOX.latMax - y * (BBOX.latMax - BBOX.latMin);
  const lng = BBOX.lngMin + x * (BBOX.lngMax - BBOX.lngMin);
  return {
    lat: Math.round(lat * REDONDEO) / REDONDEO,
    lng: Math.round(lng * REDONDEO) / REDONDEO,
  };
}

function posicionPorcentual(punto: PuntoMapa): { x: number; y: number } {
  const x =
    ((punto.lng - BBOX.lngMin) / (BBOX.lngMax - BBOX.lngMin)) * 100;
  const y =
    ((BBOX.latMax - punto.lat) / (BBOX.latMax - BBOX.latMin)) * 100;
  return { x, y };
}

const PUNTO_CENTRO: PuntoMapa = {
  lat: Math.round(((BBOX.latMax + BBOX.latMin) / 2) * REDONDEO) / REDONDEO,
  lng: Math.round(((BBOX.lngMax + BBOX.lngMin) / 2) * REDONDEO) / REDONDEO,
};

interface MapaSelectorProps {
  value: PuntoMapa | null;
  onChange: (punto: PuntoMapa) => void;
}

export function MapaSelector({
  value,
  onChange,
}: MapaSelectorProps): React.JSX.Element {
  const mapaRef = React.useRef<HTMLDivElement>(null);

  function manejarClic(event: React.MouseEvent<HTMLDivElement>): void {
    const rect = mapaRef.current?.getBoundingClientRect();
    if (!rect) return;
    onChange(puntoDesdeClic(rect, event.clientX, event.clientY));
  }

  function manejarTeclado(
    event: React.KeyboardEvent<HTMLDivElement>,
  ): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // Marca el centro del mapa: punto determinista por teclado.
      onChange(PUNTO_CENTRO);
    }
  }

  const posicion = value ? posicionPorcentual(value) : null;

  return (
    <div>
      <div
        ref={mapaRef}
        role="button"
        tabIndex={0}
        aria-label="Mapa: marca la ubicación de la mascota con un clic o con Enter"
        data-testid="mapa-mock"
        onClick={manejarClic}
        onKeyDown={manejarTeclado}
        className="relative mt-3 h-48 cursor-crosshair overflow-hidden rounded-control border border-border bg-gradient-to-br from-[#E8F5EE] via-[#F8FAFC] to-[#E8EEFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(#D7DEE8 1px, transparent 1px), linear-gradient(90deg, #D7DEE8 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden
        />
        {posicion ? (
          <div
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${posicion.x}%`, top: `${posicion.y}%` }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger text-white shadow-card">
              <MapPin className="h-5 w-5" aria-hidden />
            </span>
          </div>
        ) : (
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger text-white shadow-card">
              <MapPin className="h-5 w-5" aria-hidden />
            </span>
            <span className="mt-1 rounded-pill bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-text shadow-card">
              Haz clic para marcar
            </span>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-muted" data-testid="mapa-coordenadas">
        {value
          ? `Punto marcado: ${value.lat}, ${value.lng}`
          : 'Aún no has marcado un punto. También puedes describir la ubicación con texto.'}
      </p>
    </div>
  );
}
