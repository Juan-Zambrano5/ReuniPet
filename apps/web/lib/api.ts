import {
  AlertaResponse,
  CreateReporteInput,
  ReporteResponse,
  TipoReporte,
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
  const userId = window.localStorage.getItem('x-user-id');
  return userId ? { 'X-User-Id': userId } : {};
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
