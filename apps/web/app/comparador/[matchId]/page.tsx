'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertaResponse, ReporteResponse } from '@reunipet/shared';
import { ErrorText } from '@/components/ErrorText';
import { MatchScoreCircle } from '@/components/ui/MatchScoreCircle';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  fotoUrl,
  getAlertas,
  getReporte,
  marcarVista,
} from '@/lib/api';

export default function ComparadorPage(): React.JSX.Element {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const router = useRouter();

  const [alerta, setAlerta] = React.useState<AlertaResponse | null>(null);
  const [reportePerdida, setReportePerdida] =
    React.useState<ReporteResponse | null>(null);
  const [reporteEncontrada, setReporteEncontrada] =
    React.useState<ReporteResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [accionando, setAccionando] = React.useState(false);
  const [contactoNota, setContactoNota] = React.useState(false);

  React.useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const alertas = await getAlertas();
        const encontrada = alertas.find((a) => a.coincidenciaId === matchId);
        if (!encontrada) {
          if (!cancelado) {
            setError('No se encontró la coincidencia en tus alertas.');
            setLoading(false);
          }
          return;
        }
        const [perdida, hallazgo] = await Promise.all([
          getReporte(encontrada.reportePerdida.id),
          getReporte(encontrada.reporteEncontrada.id),
        ]);
        if (!cancelado) {
          setAlerta(encontrada);
          setReportePerdida(perdida);
          setReporteEncontrada(hallazgo);
          setLoading(false);
        }
      } catch {
        if (!cancelado) {
          setError('No se pudo cargar la coincidencia.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [matchId]);

  async function handleDescartar(): Promise<void> {
    if (!alerta) return;
    setAccionando(true);
    try {
      await marcarVista(alerta.coincidenciaId);
      router.push('/alertas');
    } catch {
      setError('No se pudo descartar. Intenta de nuevo.');
      setAccionando(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12 text-center text-muted">
        Cargando coincidencia...
      </div>
    );
  }

  if (error || !alerta || !reportePerdida || !reporteEncontrada) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12 text-center">
        <ErrorText>{error ?? 'Coincidencia no disponible.'}</ErrorText>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => router.push('/alertas')}
        >
          Volver a alertas
        </Button>
      </div>
    );
  }

  const porcentaje = Math.round(alerta.score * 100);
  const fotoPerdida = reportePerdida.fotos?.[0];
  const fotoEncontrada = reporteEncontrada.fotos?.[0];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-col items-center text-center">
        <MatchScoreCircle porcentaje={porcentaje} />
        <h1 className="mt-6 text-2xl font-bold text-text">
          Coincidencia Alta Detectada
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Basado en especie, raza y color, encontramos una posible coincidencia
          entre tu reporte perdido y un reporte de hallazgo reciente.
        </p>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <article className="rounded-card border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">Tu Reporte</h2>
            <StatusBadge variant="danger">PERDIDO</StatusBadge>
          </div>
          <div className="mt-4 flex h-40 items-center justify-center overflow-hidden rounded-control bg-surface">
            {fotoPerdida ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={fotoUrl(fotoPerdida.url)}
                alt="Foto de tu mascota perdida"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs text-muted">Sin fotografía</span>
            )}
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Especie</dt>
              <dd className="font-medium capitalize text-text">
                {reportePerdida.especie}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Raza</dt>
              <dd className="font-medium capitalize text-text">
                {reportePerdida.raza ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Color</dt>
              <dd className="font-medium capitalize text-text">
                {reportePerdida.color}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-card border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">
              Reporte Encontrado
            </h2>
            <StatusBadge variant="success">ENCONTRADO</StatusBadge>
          </div>
          <div className="mt-4 flex h-40 items-center justify-center overflow-hidden rounded-control bg-surface">
            {fotoEncontrada ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={fotoUrl(fotoEncontrada.url)}
                alt="Foto de la mascota encontrada"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs text-muted">Sin fotografía</span>
            )}
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Especie</dt>
              <dd className="font-medium capitalize text-text">
                {reporteEncontrada.especie}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Raza</dt>
              <dd className="font-medium capitalize text-text">
                {reporteEncontrada.raza ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Color</dt>
              <dd className="font-medium capitalize text-text">
                {reporteEncontrada.color}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Ubicación</dt>
              <dd className="text-right font-medium text-text">
                {reporteEncontrada.ubicacion ?? '—'}
              </dd>
            </div>
          </dl>
        </article>
      </div>

      <section className="mt-8 rounded-card bg-success-bg-soft p-6">
        <h2 className="text-lg font-semibold text-text">
          ¿Crees que es tu mascota?
        </h2>
        <p className="mt-1 text-sm text-muted">
          Si la reconoces, ponte en contacto con quien la encontró o descarta
          la alerta.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="bg-success hover:bg-success-hover sm:flex-1"
            onClick={() => setContactoNota(true)}
          >
            Contactar
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="sm:flex-1"
            onClick={handleDescartar}
            disabled={accionando}
          >
            {accionando ? 'Descartando...' : 'Descartar'}
          </Button>
        </div>
        {contactoNota && (
          <p className="mt-3 text-sm text-muted" role="status">
            Los datos de contacto estarán disponibles próximamente. Por ahora,
            descartar la alerta notifica al equipo de ReuniPet.
          </p>
        )}
        {error && (
          <div className="mt-3">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </section>
    </div>
  );
}
