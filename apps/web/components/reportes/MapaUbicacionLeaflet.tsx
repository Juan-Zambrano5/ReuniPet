'use client';

import * as React from 'react';
import L from 'leaflet';
import { ZOOM_PUNTO, crearMapa, iconoMarcador } from '@/components/mapa/leaflet';
import type { MapaUbicacionProps } from '@/components/reportes/MapaUbicacion';

export const RADIO_ZONA_M = 1000;
// Con zoom 14 el círculo de ~1 km cabe entero en el recuadro.
const ZOOM_ZONA = 14;
const COLOR_PRIMARIO = '#5B57E8';

// HU13: visor de solo lectura. Dueño: marcador exacto. Terceros: solo un
// círculo de ~1 km sobre las coordenadas aproximadas que ya envía el API.
export default function MapaUbicacionLeaflet({
  lat,
  lng,
  exacto,
}: MapaUbicacionProps): React.JSX.Element {
  const contenedorRef = React.useRef<HTMLDivElement>(null);
  const [sinTeselas, setSinTeselas] = React.useState(false);

  React.useEffect(() => {
    if (!contenedorRef.current) return;
    const mapa = crearMapa(
      contenedorRef.current,
      { lat, lng },
      exacto ? ZOOM_PUNTO : ZOOM_ZONA,
      () => setSinTeselas(true),
    );
    // La rueda del ratón desplaza la página, no hace zoom (el mapa no atrapa el scroll).
    mapa.scrollWheelZoom.disable();
    if (exacto) {
      L.marker([lat, lng], { icon: iconoMarcador, keyboard: false }).addTo(mapa);
    } else {
      L.circle([lat, lng], {
        radius: RADIO_ZONA_M,
        color: COLOR_PRIMARIO,
        fillColor: COLOR_PRIMARIO,
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(mapa);
    }
    return () => {
      mapa.remove();
    };
  }, [lat, lng, exacto]);

  return (
    <div>
      <div className="relative isolate">
        <div
          ref={contenedorRef}
          role="region"
          aria-label={
            exacto
              ? 'Mapa con el punto exacto del reporte'
              : 'Mapa con la zona aproximada del reporte'
          }
          data-testid="mapa-ubicacion"
          className="h-64 w-full overflow-hidden rounded-control border border-border bg-surface"
        />
      </div>
      {sinTeselas && (
        <p role="status" className="mt-2 text-xs text-muted">
          No se pudo cargar el mapa. La ubicación de referencia sigue arriba.
        </p>
      )}
    </div>
  );
}
