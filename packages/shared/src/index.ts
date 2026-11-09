export enum TipoReporte {
  PERDIDA = 'PERDIDA',
  ENCONTRADA = 'ENCONTRADA',
}

export enum EstadoReporte {
  PERDIDA = 'PERDIDA',
  ENCONTRADA = 'ENCONTRADA',
  RECUPERADA = 'RECUPERADA',
}

export enum EstadoCoincidencia {
  PENDIENTE = 'PENDIENTE',
  VISTA = 'VISTA',
  DESCARTADA = 'DESCARTADA',
}

// HU17: PATCH /reportes/:id. Solo se envían los campos que cambian; la
// ubicación se edita con PATCH /reportes/:id/ubicacion.
export interface UpdateReporteInput {
  especie?: string;
  raza?: string | null;
  color?: string;
  caracteristicasDistintivas?: string;
}

// HU9: PATCH /reportes/:id/ubicacion.
export interface UpdateUbicacionInput {
  latitud: number;
  longitud: number;
  ubicacion?: string;
}

export interface CreateReporteInput {
  tipo: TipoReporte;
  especie: string;
  raza?: string;
  color: string;
  caracteristicasDistintivas: string;
  ubicacion?: string;
  // HU9 AC2: se almacenan junto al texto de referencia (van juntas).
  latitud?: number;
  longitud?: number;
}

export interface ReporteResponse {
  id: string;
  tipo: TipoReporte;
  especie: string;
  raza: string | null;
  color: string;
  caracteristicasDistintivas: string;
  ubicacion: string | null;
  estado: EstadoReporte;
  // propietarioId no se expone (ni al dueño): basta con esPropietario.
  // HU9 AC3: exactas al propietario, aproximadas (~1km) a terceros.
  latitud: number | null;
  longitud: number | null;
  esPropietario: boolean;
  createdAt: string;
  updatedAt: string;
  fotos?: FotografiaResponse[];
}

export interface FotografiaResponse {
  id: string;
  reporteId: string;
  url: string;
  orden: number;
  createdAt: string;
}

export interface ReporteListItem {
  id: string;
  tipo: TipoReporte;
  especie: string;
  raza: string | null;
  color: string;
  caracteristicasDistintivas: string;
  estado: EstadoReporte;
  ubicacion: string | null;
  latitud: number | null;
  longitud: number | null;
  esPropietario: boolean;
  fotoPrincipal: FotografiaResponse | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListReportesMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListReportesResponse {
  items: ReporteListItem[];
  meta: ListReportesMeta;
}

export interface CoincidenciaResponse {
  id: string;
  reportePerdidaId: string;
  reporteEncontradaId: string;
  score: number;
  estado: EstadoCoincidencia;
  createdAt: string;
}

export interface AlertaResponse {
  coincidenciaId: string;
  score: number;
  estado: EstadoCoincidencia;
  createdAt: string;
  reportePerdida: {
    id: string;
    especie: string;
    raza: string | null;
    color: string;
    caracteristicasDistintivas: string;
  };
  reporteEncontrada: {
    id: string;
    especie: string;
    raza: string | null;
    color: string;
    ubicacion: string | null;
  };
}

export const MATCH_THRESHOLD = 0.7;

// HU10: datos de contacto del propietario de un reporte.
export interface ContactoPropietarioResponse {
  reporteId: string;
  nombre: string;
  email: string;
  telefono: string | null;
}

// HU12: registro de usuarios (POST /auth/register).
export interface RegisterInput {
  nombre: string;
  email: string;
  telefono?: string;
  password: string;
}

// Datos públicos de un usuario: nunca incluye contraseña ni hash.
export interface UsuarioPublicoResponse {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  createdAt: string;
}

// HU16: inicio de sesión (POST /auth/login).
export interface LoginInput {
  email: string;
  password: string;
}

// El token es un JWT (8 h) que viaja en `Authorization: Bearer <token>`.
export interface LoginResponse {
  token: string;
  usuario: UsuarioPublicoResponse;
}

// HU15: GET /usuarios/me/reportes — reportes propios (todos los estados).
// coincidenciasPendientes cuenta lo mismo que muestra /alertas para ese
// reporte: PENDIENTE o VISTA, sin descartadas ni reportes RECUPERADA. Las
// alertas solo llegan al dueño del reporte PERDIDA (HU4), así que en reportes
// ENCONTRADA el valor es siempre 0.
export interface MiReporteItem extends ReporteListItem {
  coincidenciasPendientes: number;
}
