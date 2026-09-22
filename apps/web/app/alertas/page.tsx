'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertaResponse } from '@reunipet/shared';
import { AppHeader } from '@/components/AppHeader';
import { AlertCard } from '@/components/alertas/AlertCard';
import { API_URL, getSessionHeaders } from '@/lib/api';

async function fetchAlertas(): Promise<AlertaResponse[]> {
  const res = await fetch(`${API_URL}/usuarios/me/alertas`, {
    headers: getSessionHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json()) as AlertaResponse[];
}

async function marcarVista(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/alertas/${id}/visto`, {
    method: 'PATCH',
    headers: getSessionHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'hace instantes';
  if (mins < 60) return `hace ${mins} minuto(s)`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} hora(s)`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día(s)`;
}

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
      setAlertas(await fetchAlertas());
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
      await marcarVista(coincidenciaId);
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
    router.push(`/reportes/${alerta.reporteEncontrada.id}`);
  }

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-text">Alertas</h1>
        <p className="mt-1 text-sm text-muted">
          Posibles coincidencias con tus reportes
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {alertas === null && (
            <p className="text-sm text-muted">Cargando alertas...</p>
          )}
          {alertas !== null && alertas.length === 0 && (
            <p
              className="rounded bg-surface px-4 py-6 text-center text-sm text-muted"
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

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <div className="mt-8">
          <Link href="/" className="text-sm text-primary hover:underline">
            ← Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
