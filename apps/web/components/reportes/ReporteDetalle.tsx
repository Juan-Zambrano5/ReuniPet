'use client';

import * as React from 'react';
import { EstadoReporte, ReporteResponse } from '@reunipet/shared';
import { ErrorText } from '@/components/ErrorText';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { fotoUrl, getReporte } from '@/lib/api';
import { tiempoRelativo } from '@/lib/tiempo';

const BADGE: Record<
  EstadoReporte,
  { variante: 'danger' | 'success' | 'neutral'; texto: string }
> = {
  [EstadoReporte.PERDIDA]: { variante: 'danger', texto: 'PERDIDO' },
  [EstadoReporte.ENCONTRADA]: { variante: 'success', texto: 'ENCONTRADO' },
  [EstadoReporte.RECUPERADA]: { variante: 'neutral', texto: 'RECUPERADO' },
};

interface ReporteDetalleProps {
  id: string;
}

export function ReporteDetalle({ id }: ReporteDetalleProps): React.JSX.Element {
  const [reporte, setReporte] = React.useState<ReporteResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const regresar = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = '/alertas';
  }, []);

  React.useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const datos = await getReporte(id);
        if (!cancelado) {
          setReporte(datos);
          setLoading(false);
        }
      } catch {
        if (!cancelado) {
          setError('No se pudo cargar el reporte.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center text-muted">
        Cargando reporte...
      </div>
    );
  }

  if (error || !reporte) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <ErrorText>{error ?? 'Reporte no disponible.'}</ErrorText>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={regresar}
        >
          Volver
        </Button>
      </div>
    );
  }

  const badge = BADGE[reporte.estado];
  const foto = reporte.fotos?.[0];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text">Detalle del reporte</h1>
        <StatusBadge variant={badge.variante}>{badge.texto}</StatusBadge>
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="flex h-64 items-center justify-center bg-surface">
          {foto ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fotoUrl(foto.url)}
              alt={`Foto de ${reporte.especie}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm text-muted">Sin fotografía</span>
          )}
        </div>

        <div className="p-6">
          <p className="text-lg font-semibold capitalize text-text">
            {reporte.especie}
            {reporte.raza ? ` (${reporte.raza})` : ''}
          </p>
          <p className="mt-1 text-sm text-muted">
            {tiempoRelativo(reporte.createdAt)}
          </p>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Color</dt>
              <dd className="font-medium capitalize text-text">
                {reporte.color}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Características distintivas</dt>
              <dd className="text-right font-medium text-text">
                {reporte.caracteristicasDistintivas || '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Ubicación de referencia</dt>
              <dd className="text-right font-medium text-text">
                {reporte.ubicacion ?? '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="mt-6"
        onClick={regresar}
      >
        Volver
      </Button>
    </div>
  );
}
