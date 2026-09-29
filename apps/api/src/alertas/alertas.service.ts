import { Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCoincidencia } from '@prisma/client';
import { AlertaResponse } from '@reunipet/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertasService {
  constructor(private readonly prisma: PrismaService) {}

  async getAlertasDeUsuario(userId: string): Promise<AlertaResponse[]> {
    const coincidencias = await this.prisma.coincidencia.findMany({
      where: {
        estado: { in: [EstadoCoincidencia.PENDIENTE, EstadoCoincidencia.VISTA] },
        reportePerdida: { propietarioId: userId },
      },
      include: {
        reportePerdida: true,
        reporteEncontrada: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return coincidencias.map((c) => ({
      coincidenciaId: c.id,
      score: c.score,
      estado: c.estado as unknown as import('@reunipet/shared').EstadoCoincidencia,
      createdAt: c.createdAt.toISOString(),
      reportePerdida: {
        id: c.reportePerdida.id,
        especie: c.reportePerdida.especie,
        raza: c.reportePerdida.raza,
        color: c.reportePerdida.color,
        caracteristicasDistintivas:
          c.reportePerdida.caracteristicasDistintivas ?? '',
      },
      reporteEncontrada: {
        id: c.reporteEncontrada.id,
        especie: c.reporteEncontrada.especie,
        raza: c.reporteEncontrada.raza,
        color: c.reporteEncontrada.color,
        ubicacion: c.reporteEncontrada.ubicacion,
      },
    }));
  }

  async descartar(coincidenciaId: string): Promise<AlertaResponse> {
    const existente = await this.prisma.coincidencia.findUnique({
      where: { id: coincidenciaId },
      include: { reportePerdida: true, reporteEncontrada: true },
    });
    if (!existente) {
      throw new NotFoundException('Alerta no encontrada');
    }

    const actualizada = await this.prisma.coincidencia.update({
      where: { id: coincidenciaId },
      data: { estado: EstadoCoincidencia.DESCARTADA },
      include: { reportePerdida: true, reporteEncontrada: true },
    });

    return this.toResponse(actualizada);
  }

  async marcarVista(coincidenciaId: string): Promise<AlertaResponse> {
    const existente = await this.prisma.coincidencia.findUnique({
      where: { id: coincidenciaId },
      include: { reportePerdida: true, reporteEncontrada: true },
    });
    if (!existente) {
      throw new NotFoundException('Alerta no encontrada');
    }

    const actualizada = await this.prisma.coincidencia.update({
      where: { id: coincidenciaId },
      data: { estado: EstadoCoincidencia.VISTA },
      include: { reportePerdida: true, reporteEncontrada: true },
    });

    return this.toResponse(actualizada);
  }

  private toResponse(c: {
    id: string;
    score: number;
    estado: EstadoCoincidencia;
    createdAt: Date;
    reportePerdida: {
      id: string;
      especie: string;
      raza: string | null;
      color: string;
      caracteristicasDistintivas: string | null;
    };
    reporteEncontrada: {
      id: string;
      especie: string;
      raza: string | null;
      color: string;
      ubicacion: string | null;
    };
  }): AlertaResponse {
    return {
      coincidenciaId: c.id,
      score: c.score,
      estado: c.estado as unknown as import('@reunipet/shared').EstadoCoincidencia,
      createdAt: c.createdAt.toISOString(),
      reportePerdida: {
        id: c.reportePerdida.id,
        especie: c.reportePerdida.especie,
        raza: c.reportePerdida.raza,
        color: c.reportePerdida.color,
        caracteristicasDistintivas:
          c.reportePerdida.caracteristicasDistintivas ?? '',
      },
      reporteEncontrada: {
        id: c.reporteEncontrada.id,
        especie: c.reporteEncontrada.especie,
        raza: c.reporteEncontrada.raza,
        color: c.reporteEncontrada.color,
        ubicacion: c.reporteEncontrada.ubicacion,
      },
    };
  }
}
