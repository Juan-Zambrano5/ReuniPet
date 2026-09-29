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

export interface CreateReporteInput {
  tipo: TipoReporte;
  especie: string;
  raza?: string;
  color: string;
  caracteristicasDistintivas: string;
  ubicacion?: string;
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
  propietarioId: string;
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
