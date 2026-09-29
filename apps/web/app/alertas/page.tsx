'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertaResponse } from '@reunipet/shared';
import { AlertCard } from '@/components/alertas/AlertCard';
import { RecientesZona } from '@/components/alertas/RecientesZona';
import { MapPin } from 'lucide-react';
import { descartarAlerta, getAlertas } from '@/lib/api';
import { tiempoRelativo } from '@/lib/tiempo';

function descripcion(alerta: AlertaResponse): string {
  const perdida = alerta.reportePerdida;
  const raza = perdida.raza ? ` (${perdida.raza})` : '';
  return `Reporte perdido: ${perdida.especie}${raza} — ${perdida.color}. Encontrado cerca de: ${
    alerta.reporteEncontrada.ubicacion ?? 'ubicación no indicada'
  }.`;
}

export default function AlertasPage(): React.JSX.Element {
  const router = useRouter();
  const [alertas, setAlertas] = React.useState<AlertaResponse[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [descartandoId, setDescartandoId] = React.useState<string | null>(null);

  const cargar = React.useCallback(async () => {
    try {
      setAlertas(await getAlertas());
      setError(null);
    } catch {
      setError('No se pudieron cargar las alertas.');
      setAlertas([]);
    }
  }, []);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  async function handleDescartar(coincidenciaId: string): Promise<void> {
    setDescartandoId(coincidenciaId);
    try {
      await descartarAlerta(coincidenciaId);
      setAlertas((prev) =>
        (prev ?? []).filter((a) => a.coincidenciaId !== coincidenciaId),
      );
    } catch {
      setError('No se pudo descartar la alerta. Intenta de nuevo.');
    } finally {
      setDescartandoId(null);
    }
  }

  function handleVer(alerta: AlertaResponse): void {
    router.push(`/comparador/${alerta.coincidenciaId}`);
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-text">Alertas</h1>
      <p className="mt-1 text-sm text-muted">
        Posibles coincidencias con tus reportes
      </p>

      {/* Bloque 1: Mapa de Alertas (visual; el mapa real es placeholder) */}
      <section
        className="mt-6 rounded-card border border-border bg-card p-6 shadow-card"
        aria-labelledby="mapa-alertas-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="mapa-alertas-title" className="text-lg font-semibold text-text">
              Mapa de Alertas
            </h2>
            <p className="mt-1 text-sm text-muted">
              Visualiza de un vistazo los reportes activos alrededor de tu zona.
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-soft">
            <MapPin className="h-5 w-5 text-primary" aria-hidden />
          </span>
        </div>
        <Link
          href="/mapa"
          className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
        >
          Abrir mapa interactivo →
        </Link>
      </section>

      {/* Bloque 2: Tus coincidencias (HU4 — backend real) */}
      <section className="mt-8" aria-labelledby="tus-coincidencias-title">
        <h2 id="tus-coincidencias-title" className="text-lg font-semibold text-text">
          Tus coincidencias
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          {alertas === null && (
            <p className="text-sm text-muted">Cargando alertas...</p>
          )}
          {alertas !== null && alertas.length === 0 && (
            <p
              className="rounded-card bg-surface px-4 py-6 text-center text-sm text-muted"
              data-testid="sin-alertas"
            >
              No tienes alertas por ahora. Publica un reporte y te avisaremos
              cuando haya posibles coincidencias.
            </p>
          )}
          {alertas?.map((alerta) => (
            <AlertCard
              key={alerta.coincidenciaId}
              id={alerta.coincidenciaId}
              mensaje={`Tu mascota "${alerta.reportePerdida.especie} ${
                alerta.reportePerdida.color
              }" coincide en ${Math.round(alerta.score * 100)}% con un reporte encontrado`}
              descripcionReporte={descripcion(alerta)}
              tiempo={tiempoRelativo(alerta.createdAt)}
              onVer={() => handleVer(alerta)}
              onDescartar={() => handleDescartar(alerta.coincidenciaId)}
              descartando={descartandoId === alerta.coincidenciaId}
            />
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {/* Bloque 3: Recientes en tu zona — HU6 (reportes perdidos reales) */}
      <section className="mt-8" aria-labelledby="recientes-title">
        <div className="flex items-center gap-2">
          <h2 id="recientes-title" className="text-lg font-semibold text-text">
            Recientes en tu zona
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          Últimos reportes de mascotas perdidas publicados por la comunidad.
        </p>
        <RecientesZona />
      </section>
    </div>
  );
}
