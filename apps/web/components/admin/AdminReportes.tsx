'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdminReporteItem, TipoReporte } from '@reunipet/shared';
import { ErrorText } from '@/components/ErrorText';
import { BADGE_ESTADO, StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, getAdminReportes, moderarReporte } from '@/lib/api';

export const MENSAJE_SOLO_ADMIN =
  'No tienes acceso: esta sección es solo para administradores.';
export const MENSAJE_MOTIVO = 'Escribe el motivo para ocultar el reporte';
const MENSAJE_ERROR = 'No se pudo completar la acción. Intenta de nuevo.';

const FECHA = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

// HU18: el administrador oculta (con motivo) y restaura reportes.
export function AdminReportes(): React.JSX.Element {
  const [soloOcultos, setSoloOcultos] = React.useState(false);
  const [reportes, setReportes] = React.useState<AdminReporteItem[] | null>(
    null,
  );
  const [errorCarga, setErrorCarga] = React.useState<string | null>(null);
  // Reporte con el formulario de motivo abierto.
  const [ocultando, setOcultando] = React.useState<string | null>(null);
  const [motivo, setMotivo] = React.useState('');
  const [errorAccion, setErrorAccion] = React.useState<{
    id: string;
    texto: string;
  } | null>(null);
  const [enCurso, setEnCurso] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelado = false;
    setReportes(null);
    setErrorCarga(null);
    getAdminReportes(soloOcultos)
      .then((datos) => {
        if (!cancelado) setReportes(datos);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        setErrorCarga(
          err instanceof ApiError && err.status === 403
            ? MENSAJE_SOLO_ADMIN
            : 'No se pudieron cargar los reportes. Intenta de nuevo.',
        );
      });
    return () => {
      cancelado = true;
    };
  }, [soloOcultos]);

  async function moderar(
    id: string,
    moderado: boolean,
    motivoTexto?: string,
  ): Promise<void> {
    if (moderado && !motivoTexto?.trim()) {
      setErrorAccion({ id, texto: MENSAJE_MOTIVO });
      return;
    }
    setEnCurso(id);
    setErrorAccion(null);
    try {
      const actualizado = await moderarReporte(
        id,
        moderado ? { moderado, motivo: motivoTexto?.trim() } : { moderado },
      );
      setReportes((prev) =>
        (prev ?? []).flatMap((r) => {
          if (r.id !== id) return [r];
          // En la vista "solo ocultos" un reporte restaurado sale de la lista.
          return soloOcultos && !actualizado.moderado ? [] : [actualizado];
        }),
      );
      setOcultando(null);
      setMotivo('');
    } catch (err) {
      setErrorAccion({
        id,
        texto:
          err instanceof ApiError && err.status === 403
            ? MENSAJE_SOLO_ADMIN
            : MENSAJE_ERROR,
      });
    } finally {
      setEnCurso(null);
    }
  }

  return (
    <div>
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrar reportes"
      >
        <Button
          variant={soloOcultos ? 'secondary' : 'default'}
          aria-pressed={!soloOcultos}
          onClick={() => setSoloOcultos(false)}
        >
          Todos
        </Button>
        <Button
          variant={soloOcultos ? 'default' : 'secondary'}
          aria-pressed={soloOcultos}
          onClick={() => setSoloOcultos(true)}
        >
          Solo ocultos
        </Button>
      </div>

      {errorCarga ? (
        <p
          role="alert"
          className="rounded-card bg-surface px-4 py-6 text-center text-sm text-destructive"
          data-testid="admin-error"
        >
          {errorCarga}
        </p>
      ) : !reportes ? (
        <p className="py-12 text-center text-sm text-muted">
          Cargando reportes...
        </p>
      ) : reportes.length === 0 ? (
        <p className="rounded-card border border-border bg-card px-4 py-12 text-center text-sm text-muted shadow-card">
          {soloOcultos ? 'No hay reportes ocultos.' : 'No hay reportes.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Reportes">
          {reportes.map((r) => {
            const badge = BADGE_ESTADO[r.estado];
            const abierto = ocultando === r.id;
            const campoId = `motivo-${r.id}`;
            return (
              <li
                key={r.id}
                className="rounded-card border border-border bg-card p-4 shadow-card"
                data-testid={`admin-reporte-${r.id}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {r.tipo === TipoReporte.PERDIDA
                        ? 'Mascota perdida'
                        : 'Mascota encontrada'}{' '}
                      · {FECHA.format(new Date(r.createdAt))}
                    </p>
                    <Link
                      href={`/reportes/${r.id}`}
                      className="mt-1 block truncate font-semibold text-text hover:text-primary hover:underline"
                    >
                      {r.especie}
                      {r.raza ? ` (${r.raza})` : ''} · {r.color}
                    </Link>
                    <p className="mt-1 truncate text-sm text-muted">
                      {r.propietarioNombre} · {r.propietarioEmail}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge variant={badge.variante}>
                        {badge.texto}
                      </StatusBadge>
                      {r.moderado && (
                        <StatusBadge variant="neutral">
                          Oculto por moderación
                        </StatusBadge>
                      )}
                    </div>
                    {r.moderado && r.motivoModeracion && (
                      <p className="mt-2 text-sm text-text">
                        Motivo: {r.motivoModeracion}
                      </p>
                    )}
                  </div>

                  {!abierto && (
                    <div className="shrink-0">
                      {r.moderado ? (
                        <Button
                          variant="secondary"
                          disabled={enCurso === r.id}
                          onClick={() => void moderar(r.id, false)}
                        >
                          {enCurso === r.id ? 'Restaurando...' : 'Restaurar'}
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setOcultando(r.id);
                            setMotivo('');
                            setErrorAccion(null);
                          }}
                        >
                          Ocultar
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {abierto && (
                  <form
                    className="mt-3 flex flex-col gap-2 rounded border border-border bg-surface p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void moderar(r.id, true, motivo);
                    }}
                    noValidate
                  >
                    <Label htmlFor={campoId}>Motivo para ocultarlo</Label>
                    <Textarea
                      id={campoId}
                      value={motivo}
                      maxLength={500}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ej: reporte duplicado, contenido inapropiado"
                      aria-invalid={errorAccion?.id === r.id ? true : undefined}
                      aria-describedby={
                        errorAccion?.id === r.id ? `${campoId}-error` : undefined
                      }
                    />
                    {errorAccion?.id === r.id && (
                      <ErrorText id={`${campoId}-error`}>
                        {errorAccion.texto}
                      </ErrorText>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="submit" disabled={enCurso === r.id}>
                        {enCurso === r.id ? 'Ocultando...' : 'Confirmar'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setOcultando(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                )}

                {!abierto && errorAccion?.id === r.id && (
                  <ErrorText>{errorAccion.texto}</ErrorText>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
