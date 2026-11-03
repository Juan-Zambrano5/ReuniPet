import {
  AlertaResponse,
  ContactoPropietarioResponse,
  CreateReporteInput,
  EstadoReporte,
  ListReportesResponse,
  MiReporteItem,
  RegisterInput,
  ReporteResponse,
  TipoReporte,
  UsuarioPublicoResponse,
} from '@reunipet/shared';

const API_URL_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const API_URL = API_URL_BASE;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API error ${status}`);
    this.name = 'ApiError';
  }
}

export function getSessionHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const userId = window.localStorage.getItem(SESION_ID_KEY);
  return userId ? { 'X-User-Id': userId } : {};
}

// HU12: sesión SIMULADA (AGENTS.md §3 y §10.3). Tras registrarse se guarda el
// id del usuario en localStorage y viaja como header X-User-Id.
// ADVERTENCIA: X-User-Id es FALSIFICABLE hasta HU16 (login + JWT, Sprint 4):
// cualquiera puede enviar el id de otro usuario. La regla "solo el
// propietario" protege contra errores de uso, NO contra un atacante.
// Nunca se guarda la contraseña: solo id y nombre (para la barra).
export const SESION_ID_KEY = 'x-user-id';
export const SESION_NOMBRE_KEY = 'x-user-nombre';
export const SESION_EVENTO = 'reunipet:sesion';

export function guardarSesion(
  usuario: Pick<UsuarioPublicoResponse, 'id' | 'nombre'>,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESION_ID_KEY, usuario.id);
  window.localStorage.setItem(SESION_NOMBRE_KEY, usuario.nombre);
  // Avisa a la barra de navegación (misma pestaña) que cambió la sesión.
  window.dispatchEvent(new Event(SESION_EVENTO));
}

export function leerNombreSesion(): string | null {
  if (typeof window === 'undefined') return null;
  if (!window.localStorage.getItem(SESION_ID_KEY)) return null;
  return window.localStorage.getItem(SESION_NOMBRE_KEY);
}

// HU12: POST /auth/register. La respuesta nunca trae contraseña ni hash.
export async function registrarUsuario(
  input: RegisterInput,
): Promise<UsuarioPublicoResponse> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.json().catch(() => ({})));
  }
  return (await res.json()) as UsuarioPublicoResponse;
}

export async function createReporte(
  input: CreateReporteInput,
): Promise<ReporteResponse> {
  const res = await fetch(`${API_URL}/reportes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getSessionHeaders(),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
  return (await res.json()) as ReporteResponse;
}

export async function getReporte(id: string): Promise<ReporteResponse> {
  const res = await fetch(`${API_URL}/reportes/${id}`, {
    headers: getSessionHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.json().catch(() => ({})));
  }
  return (await res.json()) as ReporteResponse;
}

// HU11/HU14: cambiar el estado del reporte (solo el propietario).
// El backend responde sin fotos: el frontend actualiza SOLO estado/updatedAt.
export async function cambiarEstadoReporte(
  id: string,
  estado: EstadoReporte,
): Promise<Pick<ReporteResponse, 'id' | 'estado' | 'updatedAt'>> {
  const res = await fetch(`${API_URL}/reportes/${id}/estado`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getSessionHeaders(),
    },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.json().catch(() => ({})));
  }
  return (await res.json()) as ReporteResponse;
}

// HU10: nombre + medio de contacto del propietario de un reporte.
export async function getContacto(
  id: string,
): Promise<ContactoPropietarioResponse> {
  const res = await fetch(`${API_URL}/reportes/${id}/contacto`, {
    headers: getSessionHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.json().catch(() => ({})));
  }
  return (await res.json()) as ContactoPropietarioResponse;
}

// HU8: filtros opcionales de GET /reportes (todos combinables con AND).
export interface ListadoFiltros {
  tipo?: TipoReporte;
  page?: number;
  limit?: number;
  especie?: string;
  raza?: string;
  color?: string;
  lat?: number;
  lng?: number;
  radioKm?: number;
}

export async function getReportes(
  params: ListadoFiltros = {},
): Promise<ListReportesResponse> {
  const qs = new URLSearchParams();
  if (params.tipo) qs.set('tipo', params.tipo);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.especie) qs.set('especie', params.especie);
  if (params.raza) qs.set('raza', params.raza);
  if (params.color) qs.set('color', params.color);
  // lat/lng/radioKm viajan siempre juntos (contrato del backend).
  if (params.lat !== undefined) qs.set('lat', String(params.lat));
  if (params.lng !== undefined) qs.set('lng', String(params.lng));
  if (params.radioKm !== undefined) qs.set('radioKm', String(params.radioKm));
  const query = qs.toString();
  const res = await fetch(`${API_URL}/reportes${query ? `?${query}` : ''}`, {
    headers: getSessionHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return (await res.json()) as ListReportesResponse;
}

// HU15: reportes del usuario de la sesión (todos los estados).
export async function getMisReportes(): Promise<MiReporteItem[]> {
  const res = await fetch(`${API_URL}/usuarios/me/reportes`, {
    headers: getSessionHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return (await res.json()) as MiReporteItem[];
}

export async function getAlertas(): Promise<AlertaResponse[]> {
  const res = await fetch(`${API_URL}/usuarios/me/alertas`, {
    headers: getSessionHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return (await res.json()) as AlertaResponse[];
}

export async function marcarVista(coincidenciaId: string): Promise<void> {
  const res = await fetch(`${API_URL}/alertas/${coincidenciaId}/visto`, {
    method: 'PATCH',
    headers: getSessionHeaders(),
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
}

export async function descartarAlerta(coincidenciaId: string): Promise<void> {
  const res = await fetch(`${API_URL}/alertas/${coincidenciaId}/descartar`, {
    method: 'PATCH',
    headers: getSessionHeaders(),
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
}

export function fotoUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

export function extractFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const body = error.body as
    | { message?: string | string[]; details?: Record<string, string[]> }
    | undefined;

  const fields: Record<string, string> = {};
  if (body?.details) {
    for (const [key, messages] of Object.entries(body.details)) {
      if (messages.length > 0) fields[key] = messages[0];
    }
    return fields;
  }

  const messages = Array.isArray(body?.message)
    ? body.message
    : body?.message
      ? [body.message]
      : [];

  const map: Record<string, string> = {
    especie: 'especie',
    raza: 'raza',
    color: 'color',
    caracteristicasDistintivas: 'caracteristicasDistintivas',
    ubicacion: 'ubicacion',
  };

  for (const msg of messages) {
    const lower = msg.toLowerCase();
    for (const [key, label] of Object.entries(map)) {
      if (
        lower.includes(label.toLowerCase()) ||
        (key === 'caracteristicasDistintivas' &&
          lower.includes('características'))
      ) {
        fields[key] = msg;
      }
    }
  }
  return fields;
}

export type { CreateReporteInput, ReporteResponse, TipoReporte };
