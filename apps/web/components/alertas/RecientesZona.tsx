'use client';

import * as React from 'react';
import Link from 'next/link';
import { ListReportesResponse, TipoReporte } from '@reunipet/shared';
import { MapPin } from 'lucide-react';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

/** HU8 AC2: mensaje explícito cuando los filtros no dan resultados. */
const VACIO_FILTROS =
  'No encontramos reportes que coincidan con esos filtros. Prueba con otros términos o limpia los filtros para ver el listado completo.';

interface BorradorFiltros {
  especie: string;
  raza: string;
  color: string;
  cercaDeMi: boolean;
  radioKm: string;
}

const BORRADOR_VACIO: BorradorFiltros = {
  especie: '',
  raza: '',
  color: '',
  cercaDeMi: false,
  radioKm: '10',
};

/** Filtros ya ejecutados: solo contienen las claves presentes. */
interface FiltrosAplicados {
  especie?: string;
  raza?: string;
  color?: string;
  lat?: number;
  lng?: number;
  radioKm?: number;
}

function obtenerCoords(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('geolocalizacion-no-disponible'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('geolocalizacion-denegada')),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  });
}

export function RecientesZona({
  tipoInicial = TipoReporte.PERDIDA,
}: RecientesZonaProps): React.JSX.Element {
  const [tipo, setTipo] = React.useState<TipoReporte>(tipoInicial);
  const [borrador, setBorrador] = React.useState<BorradorFiltros>(
    BORRADOR_VACIO,
  );
  const [aplicados, setAplicados] = React.useState<FiltrosAplicados>({});
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [avisoGeo, setAvisoGeo] = React.useState<string | null>(null);
  const [obteniendoCoords, setObteniendoCoords] = React.useState(false);
  const [reportes, setReportes] =
    React.useState<ListReportesResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const hayFiltrosAplicados = Object.keys(aplicados).length > 0;

  const cargar = React.useCallback(async () => {
    try {
      setReportes(await getReportes({ tipo, limit: 6, ...aplicados }));
      setError(null);
    } catch {
      setError('No se pudieron cargar los reportes recientes.');
      setReportes({ items: [], meta: { page: 1, limit: 6, total: 0, totalPages: 0 } });
    }
  }, [tipo, aplicados]);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  async function alBuscar(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setAvisoGeo(null);

    const nuevos: FiltrosAplicados = {};
    if (borrador.especie.trim()) nuevos.especie = borrador.especie.trim();
    if (borrador.raza.trim()) nuevos.raza = borrador.raza.trim();
    if (borrador.color.trim()) nuevos.color = borrador.color.trim();

    if (borrador.cercaDeMi) {
      setObteniendoCoords(true);
      let punto = coords;
      if (!punto) {
        try {
          punto = await obtenerCoords();
          setCoords(punto);
        } catch {
          setObteniendoCoords(false);
          setAvisoGeo(
            'No pudimos obtener tu ubicación. Revisa el permiso de ubicación del navegador e inténtalo de nuevo.',
          );
          return;
        }
      }
      setObteniendoCoords(false);
      nuevos.lat = punto.lat;
      nuevos.lng = punto.lng;
      nuevos.radioKm = Number(borrador.radioKm) || 10;
    }

    setAplicados(nuevos);
  }

  function alLimpiar(): void {
    setBorrador(BORRADOR_VACIO);
    setAvisoGeo(null);
    setAplicados({});
  }

  const selector = (
    <div
      className="flex gap-2"
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

  const controles = (
    <>
      {selector}
      <form
        aria-label="Buscar y filtrar reportes"
        onSubmit={(e) => void alBuscar(e)}
        className="mt-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField htmlFor="filtro-especie" label="Especie">
            <Input
              id="filtro-especie"
              name="especie"
              type="search"
              placeholder="Ej: perro"
              value={borrador.especie}
              onChange={(e) =>
                setBorrador({ ...borrador, especie: e.target.value })
              }
            />
          </FormField>
          <FormField htmlFor="filtro-raza" label="Raza">
            <Input
              id="filtro-raza"
              name="raza"
              type="search"
              placeholder="Ej: labrador"
              value={borrador.raza}
              onChange={(e) =>
                setBorrador({ ...borrador, raza: e.target.value })
              }
            />
          </FormField>
          <FormField htmlFor="filtro-color" label="Color">
            <Input
              id="filtro-color"
              name="color"
              type="search"
              placeholder="Ej: negro"
              value={borrador.color}
              onChange={(e) =>
                setBorrador({ ...borrador, color: e.target.value })
              }
            />
          </FormField>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label
            htmlFor="filtro-cerca"
            className="flex h-11 cursor-pointer items-center gap-2 text-sm text-text"
          >
            <input
              id="filtro-cerca"
              type="checkbox"
              checked={borrador.cercaDeMi}
              onChange={(e) =>
                setBorrador({ ...borrador, cercaDeMi: e.target.checked })
              }
              className="h-4 w-4 accent-primary"
            />
            Cerca de mí
          </label>

          <div className="w-24">
            <FormField htmlFor="filtro-radio" label="Radio (km)">
              <Input
                id="filtro-radio"
                name="radioKm"
                type="number"
                min={0.1}
                max={100}
                step="any"
                value={borrador.radioKm}
                disabled={!borrador.cercaDeMi}
                onChange={(e) =>
                  setBorrador({ ...borrador, radioKm: e.target.value })
                }
              />
            </FormField>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={obteniendoCoords}
            data-testid="boton-buscar"
          >
            {obteniendoCoords ? 'Buscando...' : 'Buscar'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={alLimpiar}
            data-testid="boton-limpiar"
          >
            Limpiar filtros
          </Button>
        </div>

        {avisoGeo && (
          <p
            role="alert"
            data-testid="aviso-geo"
            className="text-xs text-destructive"
          >
            {avisoGeo}
          </p>
        )}
      </form>
    </>
  );

  if (error) {
    return (
      <>
        {controles}
        <p
          role="alert"
          className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-sm text-destructive"
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
        {controles}
        <p
          className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-sm text-muted"
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
        {controles}
        <p
          className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-sm text-muted"
          data-testid="sin-recientes"
        >
          {hayFiltrosAplicados ? VACIO_FILTROS : VACIO[tipo]}
        </p>
      </>
    );
  }

  return (
    <>
      {controles}
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
