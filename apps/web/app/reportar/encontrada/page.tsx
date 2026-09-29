'use client';

import * as React from 'react';
import { TipoReporte } from '@reunipet/shared';
import { ReporteForm } from '@/components/reportes/ReporteForm';
import {
  MapaSelector,
  type PuntoMapa,
} from '@/components/reportes/MapaSelector';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default function ReportarEncontradaPage(): React.JSX.Element {
  const [punto, setPunto] = React.useState<PuntoMapa | null>(null);

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
