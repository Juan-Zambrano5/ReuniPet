'use client';

import * as React from 'react';
import { TipoReporte } from '@reunipet/shared';
import { ReporteForm } from '@/components/reportes/ReporteForm';
import {
  MapaSelector,
  type PuntoMapa,
} from '@/components/reportes/MapaSelector';
import { StepBadge } from '@/components/ui/StepBadge';
import { TipCard } from '@/components/ui/TipCard';

export default function ReportarPerdidaPage(): React.JSX.Element {
  const [punto, setPunto] = React.useState<PuntoMapa | null>(null);

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
            Usa fotos recientes y con buena luz. Incluye detalles como collar,
            manchas o cicatrices: el Comparador Inteligente las usa para
            proponer coincidencias.
          </TipCard>
        </aside>
      </div>
    </div>
  );
}
