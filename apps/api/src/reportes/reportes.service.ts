import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoReporte, Fotografia, Prisma, Reporte, Usuario } from '@prisma/client';
import {
  EstadoReporte as SharedEstadoReporte,
  FotografiaResponse,
  ListReportesResponse,
  ReporteListItem,
  ReporteResponse,
  TipoReporte,
} from '@reunipet/shared';
import { MatchingService, normalizar } from '../matching/matching.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReporteDto } from './dto/create-reporte.dto';
import { ListReportesDto } from './dto/list-reportes.dto';

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
  ) {}

  async create(dto: CreateReporteDto, user: Usuario): Promise<ReporteResponse> {
    const estado =
      dto.tipo === TipoReporte.PERDIDA
        ? EstadoReporte.PERDIDA
        : EstadoReporte.ENCONTRADA;

    const reporte: Reporte = await this.prisma.reporte.create({
      data: {
        tipo: dto.tipo,
        especie: dto.especie,
        raza: dto.raza ?? null,
        color: dto.color,
        caracteristicasDistintivas: dto.caracteristicasDistintivas,
        ubicacion: dto.ubicacion ?? null,
        estado,
        propietarioId: user.id,
      },
    });

    await this.matching.compararReporte(reporte.id);

    return this.toResponse(reporte);
  }

  async findById(id: string): Promise<ReporteResponse | null> {
    const reporte = await this.prisma.reporte.findUnique({
      where: { id },
      include: { fotos: { orderBy: { orden: 'asc' } } },
    });
    if (!reporte) return null;
    const response = this.toResponse(reporte);
    response.fotos = reporte.fotos.map((f) => ({
      id: f.id,
      reporteId: f.reporteId,
      url: f.url,
      orden: f.orden,
      createdAt: f.createdAt.toISOString(),
    }));
    return response;
  }

  async list(
    dto: ListReportesDto,
    user: Usuario,
  ): Promise<ListReportesResponse> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    // HU8: lat/lng/radioKm deben enviarse juntos (400 si falta alguno).
    const trio = [dto.lat, dto.lng, dto.radioKm];
    if (trio.some((v) => v === undefined) && trio.some((v) => v !== undefined)) {
      throw new BadRequestException(
        'lat, lng y radioKm deben enviarse juntos',
      );
    }

    const where: Prisma.ReporteWhereInput = {
      // HU7: sin tipo = ambos tipos (PERDIDA y ENCONTRADA)
      tipo: dto.tipo,
      estado: { not: EstadoReporte.RECUPERADA },
    };

    const hayFiltros =
      Boolean(dto.especie?.trim()) ||
      Boolean(dto.raza?.trim()) ||
      Boolean(dto.color?.trim()) ||
      dto.lat !== undefined;

    if (!hayFiltros) {
      // Sin filtros: paginación directa en la base de datos (HU6/HU7).
      const [total, reportes] = await Promise.all([
        this.prisma.reporte.count({ where }),
        this.prisma.reporte.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { fotos: { orderBy: { orden: 'asc' } } },
        }),
      ]);

      return {
        items: reportes.map((r) => this.toListItem(r, user.id)),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // HU8: los filtros de texto son tolerantes a mayúsculas/acentos y la
    // distancia usa Haversine, así que se filtra en memoria sobre los
    // candidatos (campos escalares) y se pagina el resultado.
    // TODO: si el volumen de reportes crece, migrar a filtro SQL con extensión unaccent en el service
    const candidatos = await this.prisma.reporte.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        especie: true,
        raza: true,
        color: true,
        latitud: true,
        longitud: true,
      },
    });

    const filtrados = candidatos.filter((c) => this.pasaFiltros(c, dto));
    const total = filtrados.length;
    const desde = (page - 1) * limit;
    const paginaIds = filtrados.slice(desde, desde + limit).map((c) => c.id);

    const pagina: Reporte[] =
      paginaIds.length > 0
        ? await this.prisma.reporte.findMany({
            where: { id: { in: paginaIds } },
            include: { fotos: { orderBy: { orden: 'asc' } } },
          })
        : [];
    const porId = new Map(pagina.map((r) => [r.id, r]));
    const ordenados = paginaIds
      .map((id) => porId.get(id))
      .filter((r): r is Reporte & { fotos: Fotografia[] } => r !== undefined);

    return {
      items: ordenados.map((r) => this.toListItem(r, user.id)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** HU8: AND de los filtros de texto + radio Haversine. */
  private pasaFiltros(
    candidato: {
      especie: string;
      raza: string | null;
      color: string;
      latitud: number | null;
      longitud: number | null;
    },
    dto: ListReportesDto,
  ): boolean {
    if (
      dto.especie?.trim() &&
      !this.coincideTexto(candidato.especie, dto.especie)
    ) {
      return false;
    }
    if (dto.raza?.trim() && !this.coincideTexto(candidato.raza, dto.raza)) {
      return false;
    }
    if (dto.color?.trim() && !this.coincideTexto(candidato.color, dto.color)) {
      return false;
    }
    if (dto.lat !== undefined) {
      if (candidato.latitud === null || candidato.longitud === null) {
        return false;
      }
      const distancia = this.haversineKm(
        dto.lat,
        dto.lng as number,
        candidato.latitud,
        candidato.longitud,
      );
      if (distancia > (dto.radioKm as number)) return false;
    }
    return true;
  }

  /** Coincidencia tolerante: minúsculas, sin acentos, subcadena. */
  private coincideTexto(
    campo: string | null,
    filtro: string,
  ): boolean {
    if (campo === null) return false;
    return normalizar(campo).includes(normalizar(filtro));
  }

  /** Distancia en km entre dos puntos (fórmula de Haversine, R = 6371 km). */
  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (grados: number): number => (grados * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
  }

  private toListItem(
    reporte: Reporte & { fotos: Fotografia[] },
    userId: string,
  ): ReporteListItem {
    const esPropietario = reporte.propietarioId === userId;
    return {
      id: reporte.id,
      tipo: reporte.tipo as TipoReporte,
      especie: reporte.especie,
      raza: reporte.raza,
      color: reporte.color,
      caracteristicasDistintivas: reporte.caracteristicasDistintivas ?? '',
      estado: reporte.estado as SharedEstadoReporte,
      ubicacion: reporte.ubicacion,
      latitud:
        reporte.latitud === null || esPropietario
          ? reporte.latitud
          : this.aproximar(reporte.latitud),
      longitud:
        reporte.longitud === null || esPropietario
          ? reporte.longitud
          : this.aproximar(reporte.longitud),
      esPropietario,
      fotoPrincipal:
        reporte.fotos.length > 0
          ? this.toFotografiaResponse(reporte.fotos[0])
          : null,
      createdAt: reporte.createdAt.toISOString(),
      updatedAt: reporte.updatedAt.toISOString(),
    };
  }

  // HU9 AC3: redondea a ~1km (~0.01°) para usuarios que no son el propietario
  private aproximar(valor: number): number {
    const factor = 100;
    return Math.round(valor * factor) / factor;
  }

  private toFotografiaResponse(foto: Fotografia): FotografiaResponse {
    return {
      id: foto.id,
      reporteId: foto.reporteId,
      url: foto.url,
      orden: foto.orden,
      createdAt: foto.createdAt.toISOString(),
    };
  }

  private toResponse(reporte: Reporte): ReporteResponse {
    return {
      id: reporte.id,
      tipo: reporte.tipo as TipoReporte,
      especie: reporte.especie,
      raza: reporte.raza,
      color: reporte.color,
      caracteristicasDistintivas: reporte.caracteristicasDistintivas ?? '',
      ubicacion: reporte.ubicacion,
      estado: reporte.estado as SharedEstadoReporte,
      propietarioId: reporte.propietarioId,
      createdAt: reporte.createdAt.toISOString(),
      updatedAt: reporte.updatedAt.toISOString(),
    };
  }
}
