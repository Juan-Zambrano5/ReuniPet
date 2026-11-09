import {
  AlertaResponse,
  ContactoPropietarioResponse,
  CreateReporteInput,
  EstadoReporte,
  ListReportesResponse,
  LoginInput,
  LoginResponse,
  MiReporteItem,
  RegisterInput,
  ReporteResponse,
  TipoReporte,
  UpdateReporteInput,
  UpdateUbicacionInput,
  UsuarioPublicoResponse,
} from '@reunipet/shared';
import { cerrarSesion, leerToken, sesionNoAutorizada } from './sesion';

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

// HU16: la sesión vive en lib/sesion.ts (token JWT). Se reexportan las
// funciones que ya usaban los componentes.
export {
  SESION_EVENTO,
  cerrarSesion,
  guardarSesion,
  haySesion,
  leerNombreSesion,
} from './sesion';

export function getSessionHeaders(): Record<string, string> {
  const token = leerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch al API con el token de la sesión. HU16 AC4: un 401 limpia la sesión y
 * lleva a /login ("Tu sesión expiró"); la promesa sigue devolviendo la
 * respuesta para que el llamador lance su ApiError como siempre.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...getSessionHeaders(), ...(init.headers as Record<string, string>) },
  });
  if (res.status === 401) sesionNoAutorizada();
  return res;
}

/**
 * Fetch para rutas públicas (GET /reportes y GET /reportes/:id, decisión 10
 * del plan): se envía el token si hay, para que el dueño vea sus botones,
 * pero un 401 (token vencido o inválido) NO lleva a /login: se cierra la
 * sesión en silencio y se repite la consulta como anónimo.
 */
export async function apiFetchPublico(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...getSessionHeaders(), ...(init.headers as Record<string, string>) },
  });
  if (res.status !== 401 || !leerToken()) return res;
  cerrarSesion();
  return fetch(`${API_URL}${path}`, init);
}

// HU16: POST /auth/login. Aquí un 401 significa credenciales incorrectas, no
// sesión vencida: por eso NO pasa por apiFetch.
export async function iniciarSesion(input: LoginInput): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.json().catch(() => ({})));
  }
  return (await res.json()) as LoginResponse;
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
  const res = await apiFetch(`/reportes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
  const res = await apiFetchPublico(`/reportes/${id}`, {
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
  const res = await apiFetch(`/reportes/${id}/estado`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.json().catch(() => ({})));
  }
  return (await res.json()) as ReporteResponse;
}

// HU17: editar especie, raza, color y características (solo el propietario).
// Se envían solo los campos que cambiaron.
export async function actualizarReporte(
  id: string,
  cambios: UpdateReporteInput,
): Promise<ReporteResponse> {
  const res = await apiFetch(`/reportes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.json().catch(() => ({})));
  }
  return (await res.json()) as ReporteResponse;
}

// HU9/HU17: punto en el mapa (y texto de referencia) del reporte.
export async function actualizarUbicacion(
  id: string,
  ubicacion: UpdateUbicacionInput,
): Promise<ReporteResponse> {
  const res = await apiFetch(`/reportes/${id}/ubicacion`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ubicacion),
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
  const res = await apiFetch(`/reportes/${id}/contacto`, {
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
  const res = await apiFetchPublico(`/reportes${query ? `?${query}` : ''}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return (await res.json()) as ListReportesResponse;
}

// HU15: reportes del usuario de la sesión (todos los estados).
export async function getMisReportes(): Promise<MiReporteItem[]> {
  const res = await apiFetch(`/usuarios/me/reportes`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return (await res.json()) as MiReporteItem[];
}

export async function getAlertas(): Promise<AlertaResponse[]> {
  const res = await apiFetch(`/usuarios/me/alertas`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return (await res.json()) as AlertaResponse[];
}

export async function marcarVista(coincidenciaId: string): Promise<void> {
  const res = await apiFetch(`/alertas/${coincidenciaId}/visto`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
}

export async function descartarAlerta(coincidenciaId: string): Promise<void> {
  const res = await apiFetch(`/alertas/${coincidenciaId}/descartar`, {
    method: 'PATCH',
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
