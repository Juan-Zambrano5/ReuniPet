import { Injectable } from '@nestjs/common';
import { EstadoReporte, Fotografia, Prisma, Reporte, Usuario } from '@prisma/client';
import {
  EstadoReporte as SharedEstadoReporte,
  FotografiaResponse,
  ListReportesResponse,
  ReporteListItem,
  ReporteResponse,
  TipoReporte,
} from '@reunipet/shared';
import { MatchingService } from '../matching/matching.service';
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

    const where: Prisma.ReporteWhereInput = {
      tipo: dto.tipo ?? TipoReporte.PERDIDA,
      estado: { not: EstadoReporte.RECUPERADA },
    };

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
