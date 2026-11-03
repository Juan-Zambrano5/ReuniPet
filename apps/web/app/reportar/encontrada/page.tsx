'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { TipoReporte } from '@reunipet/shared';
import { ReporteForm } from '@/components/reportes/ReporteForm';
import {
  MapaSelector,
  type PuntoMapa,
} from '@/components/reportes/MapaSelector';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { leerBorrador } from '@/lib/borrador';

export default function ReportarEncontradaPage(): React.JSX.Element {
  const router = useRouter();
  const [punto, setPunto] = React.useState<PuntoMapa | null>(null);
  // El router del mock se crea nuevo en cada render: el ref garantiza que
  // este efecto corra una sola vez (evita bucles de redirección).
  const iniciadoRef = React.useRef(false);

  // HU3: al volver del paso 2 se restaura el punto marcado en el mapa.
  // Caso 2 (mismo criterio que HU1): si el reporte YA se creó (reporteId en
  // el borrador), el paso 1 redirige al paso 2 — cubre también el botón
  // Atrás del navegador y evita un segundo reporte.
  React.useEffect(() => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;
    const borrador = leerBorrador();
    // Un borrador de otro tipo no corresponde a esta página.
    if (!borrador || borrador.tipo !== TipoReporte.ENCONTRADA) return;
    if (borrador.reporteId) {
      router.replace('/reportar/encontrada/fotos');
      return;
    }
    if (
      typeof borrador.latitud === 'number' &&
      typeof borrador.longitud === 'number'
    ) {
      setPunto({ lat: borrador.latitud, lng: borrador.longitud });
    }
  }, [router]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <StatusBadge variant="success">Reporte de Hallazgo</StatusBadge>
          <h1 className="mt-4 text-2xl font-bold text-text">
            Mascota Encontrada
          </h1>
          <p className="mt-1 text-sm text-muted">
            Registra la mascota que encontraste y su ubicación para avisar a su
            propietario.
          </p>
          <div className="mt-6">
            <ReporteForm tipo={TipoReporte.ENCONTRADA} punto={punto} />
          </div>
        </div>

        <aside>
          <div className="rounded-card border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-semibold text-text">
              Ubicación de Referencia
            </p>
            <MapaSelector value={punto} onChange={setPunto} />
            <p className="mt-2 text-xs text-muted">
              Marca el punto exacto del hallazgo o descríbelo con texto en el
              formulario: ambos sirven para que el propietario te encuentre.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
