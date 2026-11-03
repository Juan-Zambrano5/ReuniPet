'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, PawPrint } from 'lucide-react';
import { MiReporteItem, TipoReporte } from '@reunipet/shared';
import { BADGE_ESTADO, StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { fotoUrl, getMisReportes } from '@/lib/api';
import { tiempoRelativo } from '@/lib/tiempo';

const FECHA = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function textoCoincidencias(n: number): string {
  return n === 1 ? '1 posible coincidencia' : `${n} posibles coincidencias`;
}

// HU15: reportes del usuario actual (todos los estados), del más reciente
// al más antiguo, con el número de coincidencias pendientes de cada uno.
export function MisReportes(): React.JSX.Element {
  const [reportes, setReportes] = React.useState<MiReporteItem[] | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelado = false;
    getMisReportes()
      .then((datos) => {
        if (!cancelado) setReportes(datos);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-card bg-surface px-4 py-6 text-center text-sm text-destructive"
      >
        No se pudieron cargar tus reportes. Intenta de nuevo.
      </p>
    );
  }

  if (!reportes) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        Cargando tus reportes...
      </p>
    );
  }

  // AC3: estado vacío que invita a crear un reporte.
  if (reportes.length === 0) {
    return (
      <div
        className="flex flex-col items-center rounded-card border border-border bg-card px-6 py-12 text-center shadow-card"
        data-testid="mis-reportes-vacio"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
          <PawPrint className="h-6 w-6 text-primary" aria-hidden />
        </span>
        <p className="mt-4 font-semibold text-text">
          Todavía no tienes reportes
        </p>
        <p className="mt-1 text-sm text-muted">
          Cuando reportes una mascota perdida o encontrada, aquí podrás seguir
          su estado hasta el reencuentro.
        </p>
        <Button asChild className="mt-6">
          <Link href="/reportar/perdida">Reportar mascota</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2" aria-label="Mis reportes">
      {reportes.map((r) => {
        const badge = BADGE_ESTADO[r.estado];
        return (
          <li
            key={r.id}
            className="flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card transition-colors hover:border-primary"
            data-testid={`mi-reporte-${r.id}`}
          >
            <Link
              href={`/reportes/${r.id}`}
              className="flex flex-1 flex-col p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-control bg-surface">
                {r.fotoPrincipal ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={fotoUrl(r.fotoPrincipal.url)}
                    alt={`Foto de ${r.especie}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <PawPrint className="h-8 w-8 text-muted" aria-label="Sin foto" />
                )}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {r.tipo === TipoReporte.PERDIDA
                      ? 'Mascota perdida'
                      : 'Mascota encontrada'}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-text">
                    {r.especie}
                    {r.raza ? ` (${r.raza})` : ''}
                  </p>
                </div>
                <StatusBadge variant={badge.variante}>{badge.texto}</StatusBadge>
              </div>
              <p className="mt-2 text-xs text-muted">
                <time dateTime={r.createdAt}>
                  {FECHA.format(new Date(r.createdAt))}
                </time>{' '}
                · {tiempoRelativo(r.createdAt)}
              </p>
            </Link>

            {/* AC2: cuántas coincidencias hay y acceso para verlas. */}
            {r.coincidenciasPendientes > 0 && (
              <Link
                href="/alertas"
                className="flex items-center gap-2 border-t border-border bg-primary-soft px-4 py-2 text-sm font-medium text-primary hover:underline"
                data-testid={`coincidencias-${r.id}`}
              >
                <Bell className="h-4 w-4" aria-hidden />
                {textoCoincidencias(r.coincidenciasPendientes)}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
