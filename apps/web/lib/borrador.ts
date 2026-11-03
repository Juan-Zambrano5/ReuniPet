import { TipoReporte } from '@reunipet/shared';

/**
 * Borrador del reporte de mascota perdida (flujo en 2 pasos).
 *
 * El paso 1 ya NO publica: guarda lo escrito aquí y el paso 2 es quien crea
 * el reporte. Se usa `sessionStorage` para que el borrador sobreviva a una
 * recarga de la pestaña y se comparta entre las dos páginas.
 */
export interface BorradorReporte {
  tipo: TipoReporte;
  especie: string;
  raza: string;
  color: string;
  caracteristicasDistintivas: string;
  ubicacion: string;
  latitud?: number;
  longitud?: number;
  /**
   * Id del reporte ya creado en el paso 2. Se persiste para reintentar la
   * subida de fotos sin crear un reporte duplicado.
   */
  reporteId?: string;
}

const STORAGE_KEY = 'reunipet:borrador-reporte';

export function guardarBorrador(borrador: BorradorReporte): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(borrador));
}

export function leerBorrador(): BorradorReporte | null {
  if (typeof window === 'undefined') return null;
  const crudo = window.sessionStorage.getItem(STORAGE_KEY);
  if (!crudo) return null;
  try {
    const datos = JSON.parse(crudo) as Partial<BorradorReporte> | null;
    if (
      !datos ||
      typeof datos.tipo !== 'string' ||
      typeof datos.especie !== 'string' ||
      typeof datos.color !== 'string' ||
      typeof datos.caracteristicasDistintivas !== 'string'
    ) {
      return null;
    }
    return datos as BorradorReporte;
  } catch {
    // JSON corrupto: se trata como si no hubiera borrador.
    return null;
  }
}

export function limpiarBorrador(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

/** Ruta del paso 2 (fotos) según el tipo de reporte. */
export function rutaPaso2(tipo: TipoReporte): string {
  return tipo === TipoReporte.ENCONTRADA
    ? '/reportar/encontrada/fotos'
    : '/reportar/perdida/fotos';
}

/** Ruta del paso 1 (datos) según el tipo de reporte. */
export function rutaPaso1(tipo: TipoReporte): string {
  return tipo === TipoReporte.ENCONTRADA
    ? '/reportar/encontrada'
    : '/reportar/perdida';
}
