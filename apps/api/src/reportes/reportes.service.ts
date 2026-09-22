import { Injectable } from '@nestjs/common';
import { EstadoReporte, Reporte, Usuario } from '@prisma/client';
import {
  EstadoReporte as SharedEstadoReporte,
  ReporteResponse,
  TipoReporte,
} from '@reunipet/shared';
import { MatchingService } from '../matching/matching.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReporteDto } from './dto/create-reporte.dto';

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
