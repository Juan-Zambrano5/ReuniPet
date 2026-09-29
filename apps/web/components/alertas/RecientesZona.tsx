'use client';

import * as React from 'react';
import Link from 'next/link';
import { ListReportesResponse, TipoReporte } from '@reunipet/shared';
import { MapPin } from 'lucide-react';
import { fotoUrl, getReportes } from '@/lib/api';
import { tiempoRelativo } from '@/lib/tiempo';

interface RecientesZonaProps {
  tipoInicial?: TipoReporte;
}

const VACIO: Record<TipoReporte, string> = {
  [TipoReporte.PERDIDA]:
    'No hay reportes de mascotas perdidas por ahora. Si pierdes a tu mascota, publícala y la comunidad la ayudará a aparecer.',
  [TipoReporte.ENCONTRADA]:
    'Aún no hay reportes de mascotas encontradas. Si encuentras una, publícala para ayudar a su familia a recuperarla.',
};

export function RecientesZona({
  tipoInicial = TipoReporte.PERDIDA,
}: RecientesZonaProps): React.JSX.Element {
  const [tipo, setTipo] = React.useState<TipoReporte>(tipoInicial);
  const [reportes, setReportes] =
    React.useState<ListReportesResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const cargar = React.useCallback(async () => {
    try {
      setReportes(await getReportes({ tipo, limit: 6 }));
      setError(null);
    } catch {
      setError('No se pudieron cargar los reportes recientes.');
      setReportes({ items: [], meta: { page: 1, limit: 6, total: 0, totalPages: 0 } });
    }
  }, [tipo]);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  const selector = (
    <div
      className="mt-4 flex gap-2"
      role="group"
      aria-label="Filtrar reportes recientes"
    >
      {([TipoReporte.PERDIDA, TipoReporte.ENCONTRADA] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={tipo === t}
          onClick={() => setTipo(t)}
          className={
            tipo === t
              ? 'rounded-pill bg-primary-soft px-3 py-1 text-xs font-semibold text-primary'
              : 'rounded-pill bg-surface px-3 py-1 text-xs font-semibold text-muted hover:text-text'
          }
        >
          {t === TipoReporte.PERDIDA ? 'Perdidas' : 'Encontradas'}
        </button>
      ))}
    </div>
  );

  if (error) {
    return (
      <>
        {selector}
        <p
          role="alert"
          className="rounded-card bg-surface px-4 py-6 text-center text-sm text-destructive"
          data-testid="recientes-error"
        >
          {error}
        </p>
      </>
    );
  }

  if (reportes === null) {
    return (
      <>
        {selector}
        <p
          className="rounded-card bg-surface px-4 py-6 text-center text-sm text-muted"
          data-testid="recientes-loading"
        >
          Cargando reportes recientes...
        </p>
      </>
    );
  }

  if (reportes.items.length === 0) {
    return (
      <>
        {selector}
        <p
          className="rounded-card bg-surface px-4 py-6 text-center text-sm text-muted"
          data-testid="sin-recientes"
        >
          {VACIO[tipo]}
        </p>
      </>
    );
  }

  return (
    <>
      {selector}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {reportes.items.map((reporte) => (
          <Link
            key={reporte.id}
            href={`/reportes/${reporte.id}`}
            className="rounded-card border border-border bg-card p-4 shadow-card transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            data-testid={`reciente-${reporte.id}`}
          >
            {reporte.fotoPrincipal && (
              <div className="mb-3 h-32 overflow-hidden rounded-control bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoUrl(reporte.fotoPrincipal.url)}
                  alt={`Foto de ${reporte.especie}`}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <p className="text-sm font-semibold text-text">
              {reporte.especie}
              {reporte.raza ? ` (${reporte.raza})` : ''}
            </p>
            <p className="mt-1 text-sm text-muted">{reporte.color}</p>
            <p className="mt-2 flex items-center gap-1 text-xs text-muted">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {reporte.ubicacion ?? 'Ubicación no indicada'}
            </p>
            <p className="mt-1 text-xs text-muted">
              {tiempoRelativo(reporte.createdAt)}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
