'use client';

import * as React from 'react';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import {
  EstadoReporte,
  ReporteResponse,
  TipoReporte,
} from '@reunipet/shared';
import { ErrorText } from '@/components/ErrorText';
import { BADGE_ESTADO, StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { ApiError, cambiarEstadoReporte, fotoUrl, getReporte } from '@/lib/api';
import { tiempoRelativo } from '@/lib/tiempo';

interface ReporteDetalleProps {
  id: string;
}

export function ReporteDetalle({ id }: ReporteDetalleProps): React.JSX.Element {
  const [reporte, setReporte] = React.useState<ReporteResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [noEncontrado, setNoEncontrado] = React.useState(false);
  const [fotoIndex, setFotoIndex] = React.useState(0);
  const [confirmando, setConfirmando] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [errorEstado, setErrorEstado] = React.useState<string | null>(null);

  const regresar = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = '/';
  }, []);

  // HU11/HU14: cambiar el estado del reporte. El PATCH no trae fotos, así
  // que solo se actualizan estado y updatedAt en pantalla (ajuste aprobado).
  const cambiarA = React.useCallback(
    async (nuevoEstado: EstadoReporte) => {
      if (!reporte) return;
      setGuardando(true);
      setErrorEstado(null);
      try {
        const actualizado = await cambiarEstadoReporte(
          reporte.id,
          nuevoEstado,
        );
        setReporte((prev) =>
          prev
            ? {
                ...prev,
                estado: actualizado.estado,
                updatedAt: actualizado.updatedAt,
              }
            : prev,
        );
        setConfirmando(false);
      } catch {
        setErrorEstado('No se pudo actualizar el estado del reporte.');
      } finally {
        setGuardando(false);
      }
    },
    [reporte],
  );

  React.useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    setNoEncontrado(false);
    setFotoIndex(0);
    setConfirmando(false);
    setErrorEstado(null);
    void (async () => {
      try {
        const datos = await getReporte(id);
        if (!cancelado) {
          setReporte(datos);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelado) {
          if (err instanceof ApiError && err.status === 404) {
            setNoEncontrado(true);
          } else {
            setError('No se pudo cargar el reporte.');
          }
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

  // HU13 AC3: reporte inexistente → mensaje claro con enlace al listado.
  if (noEncontrado) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-text" data-testid="no-encontrado">
          Reporte no encontrado
        </h1>
        <p className="mt-2 text-sm text-muted">
          Es posible que el reporte haya sido eliminado o que el enlace sea
          incorrecto.
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href="/">Volver al listado</Link>
        </Button>
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

  const badge = BADGE_ESTADO[reporte.estado];
  const fotos = reporte.fotos ?? [];
  const fotoActual = fotos[fotoIndex];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text">Detalle del reporte</h1>
        <StatusBadge variant={badge.variante}>{badge.texto}</StatusBadge>
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-card shadow-card">
        {/* HU13 AC2: sin fotos, un mensaje de reemplazo (nunca un espacio roto). */}
        {/* La caja se adapta a la proporción de la foto (sin recortarla):
            ancho completo en horizontales, hasta 70vh y centrada en verticales. */}
        <div
          className={`flex items-center justify-center bg-surface ${
            fotoActual ? '' : 'h-64'
          }`}
          data-testid="galeria-principal"
        >
          {fotoActual ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fotoUrl(fotoActual.url)}
              alt={`Foto ${fotoIndex + 1} de ${reporte.especie}`}
              className="block h-auto max-h-[70vh] w-auto max-w-full object-contain"
              data-testid="foto-principal"
            />
          ) : (
            <div className="px-6 text-center" data-testid="foto-placeholder">
              <p className="text-sm font-medium text-muted">
                Este reporte no tiene fotografías
              </p>
              <p className="mt-1 text-xs text-muted">
                Puedes reconocerlo por sus características distintivas
              </p>
            </div>
          )}
        </div>

        {/* Miniaturas clicables cuando hay más de una foto. */}
        {fotos.length > 1 && (
          <div
            className="flex gap-2 border-t border-border p-3"
            data-testid="galeria-miniaturas"
          >
            {fotos.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFotoIndex(i)}
                aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
                aria-pressed={i === fotoIndex}
                className={`h-14 w-14 overflow-hidden rounded border-2 transition-colors ${
                  i === fotoIndex
                    ? 'border-primary'
                    : 'border-transparent hover:border-border'
                }`}
                data-testid={`miniatura-${i}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoUrl(f.url)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        <div className="p-6">
          <p
            className="text-xs font-semibold uppercase tracking-wide text-muted"
            data-testid="reporte-tipo"
          >
            {reporte.tipo === 'PERDIDA'
              ? 'Mascota perdida'
              : 'Mascota encontrada'}
          </p>
          <p className="mt-1 text-lg font-semibold capitalize text-text">
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
            {reporte.latitud !== null && reporte.longitud !== null && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Coordenadas</dt>
                <dd
                  className="text-right font-medium text-text"
                  data-testid="reporte-coordenadas"
                >
                  <span>
                    {reporte.latitud}, {reporte.longitud}
                  </span>
                  <span
                    className={`mt-1 block rounded-pill px-2 py-0.5 text-[11px] font-semibold ${
                      reporte.esPropietario
                        ? 'bg-primary-soft text-primary'
                        : 'bg-surface text-muted'
                    }`}
                    data-testid="reporte-precision"
                  >
                    {reporte.esPropietario
                      ? 'Punto exacto (tú eres el propietario)'
                      : 'Zona aproximada (~1 km)'}
                  </span>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* HU11: el panel de estado se muestra solo al propietario. */}
      {reporte.esPropietario && (
        <div
          className="mt-6 rounded-card border border-border bg-card p-4 shadow-card"
          data-testid="panel-estado"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text">
              Estado de tu reporte
            </p>
            {/* HU17: editar la información (solo el propietario ve este panel). */}
            <Link
              href={`/reportes/${reporte.id}/editar`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              data-testid="enlace-editar"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Editar información
            </Link>
          </div>

          {reporte.estado !== EstadoReporte.RECUPERADA ? (
            confirmando ? (
              <div
                className="mt-3 rounded border border-border bg-surface p-3"
                data-testid="confirmacion-recuperada"
              >
                <p className="text-sm text-text">
                  ¿Marcar tu mascota como recuperada? El reporte dejará de
                  aparecer en los listados públicos y no generará nuevas
                  alertas.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      void cambiarA(EstadoReporte.RECUPERADA);
                    }}
                    disabled={guardando}
                    data-testid="btn-confirmar-recuperada"
                  >
                    {guardando ? 'Guardando...' : 'Sí, marcar como recuperada'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmando(false)}
                    disabled={guardando}
                  >
                    Cancelar
                  </Button>
                </div>
                {errorEstado && <ErrorText>{errorEstado}</ErrorText>}
              </div>
            ) : (
              <Button
                type="button"
                className="mt-3"
                onClick={() => setConfirmando(true)}
                data-testid="btn-marcar-recuperada"
              >
                Marcar como recuperada
              </Button>
            )
          ) : (
            <div className="mt-2" data-testid="estado-recuperada">
              <p className="text-sm text-muted">
                Este reporte está marcado como recuperado. Ya no aparece en los
                listados públicos.
              </p>
              {confirmando ? (
                <div
                  className="mt-3 rounded border border-border bg-surface p-3"
                  data-testid="confirmacion-reabrir"
                >
                  <p className="text-sm text-text">
                    ¿Reabrir el reporte? Volverá a aparecer en los listados
                    públicos y se reanudarán las alertas de coincidencias.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        // HU14: reabrir vuelve al estado activo según el tipo.
                        void cambiarA(
                          reporte.tipo === TipoReporte.PERDIDA
                            ? EstadoReporte.PERDIDA
                            : EstadoReporte.ENCONTRADA,
                        );
                      }}
                      disabled={guardando}
                      data-testid="btn-confirmar-reabrir"
                    >
                      {guardando ? 'Guardando...' : 'Sí, reabrir'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setConfirmando(false)}
                      disabled={guardando}
                    >
                      Cancelar
                    </Button>
                  </div>
                  {errorEstado && <ErrorText>{errorEstado}</ErrorText>}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setConfirmando(true)}
                  data-testid="btn-reabrir"
                >
                  Reabrir reporte
                </Button>
              )}
            </div>
          )}
        </div>
      )}

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
