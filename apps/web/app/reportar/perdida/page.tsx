'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { TipoReporte } from '@reunipet/shared';
import { ReporteForm } from '@/components/reportes/ReporteForm';
import {
  MapaSelector,
  type PuntoMapa,
} from '@/components/reportes/MapaSelector';
import { StepBadge } from '@/components/ui/StepBadge';
import { TipCard } from '@/components/ui/TipCard';
import { leerBorrador } from '@/lib/borrador';

export default function ReportarPerdidaPage(): React.JSX.Element {
  const router = useRouter();
  const [punto, setPunto] = React.useState<PuntoMapa | null>(null);
  // El router del mock se crea nuevo en cada render: el ref garantiza que
  // este efecto corra una sola vez (evita bucles de redirección).
  const iniciadoRef = React.useRef(false);

  // HU1: al volver del paso 2 (o tras recargar) se restaura el punto marcado
  // en el mapa, que vive en el mismo borrador que los campos del formulario.
  // Caso 2: si el reporte YA se creó (reporteId en el borrador), el paso 1
  // redirige al paso 2 — así también se cubre el botón Atrás del navegador
  // y nunca se puede crear un segundo reporte desde aquí.
  React.useEffect(() => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;
    const borrador = leerBorrador();
    if (!borrador) return;
    if (borrador.reporteId) {
      router.replace('/reportar/perdida/fotos');
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
          <StepBadge
            paso={1}
            total={2}
            descripcion="Completa los datos de tu mascota"
          />
          <h1 className="mt-4 text-2xl font-bold text-text">
            Reportar Mascota Perdida
          </h1>
          <p className="mt-1 text-sm text-muted">
            Cuéntanos cómo es tu mascota para que la comunidad pueda ayudarte
            a encontrarla.
          </p>
          <div className="mt-6">
            <ReporteForm tipo={TipoReporte.PERDIDA} punto={punto} />
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-card border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-semibold text-text">
              Última ubicación vista (opcional)
            </p>
            <MapaSelector value={punto} onChange={setPunto} />
            <p className="mt-2 text-xs text-muted">
              Si la viste en el mapa, marca el punto o escribe una referencia
              con texto en el formulario.
            </p>
          </div>
          <TipCard titulo="Consejo útil">
            Completa especie, raza y color con precisión: son los datos que
            usamos para buscar coincidencias. Las características distintivas
            ayudan a quien la encuentre a reconocerla.
          </TipCard>
        </aside>
      </div>
    </div>
  );
}
