import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
        // HU11: se excluyen las coincidencias que involucran reportes
        // RECUPERADA. Se filtra AL CONSULTAR (sin tocar datos), para que
        // reabrir un reporte devuelva sus alertas de forma reversible.
        reportePerdida: { propietarioId: userId, estado: { not: 'RECUPERADA' } },
        reporteEncontrada: { estado: { not: 'RECUPERADA' } },
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

  /**
   * HU4 (seguridad): la alerta pertenece al dueño del reporte PERDIDA, que es
   * quien la recibe en GET /usuarios/me/alertas. 404 si no existe; 403 si es
   * de otro usuario (sin modificar nada).
   */
  private async buscarPropia(coincidenciaId: string, userId: string) {
    const existente = await this.prisma.coincidencia.findUnique({
      where: { id: coincidenciaId },
      include: { reportePerdida: true, reporteEncontrada: true },
    });
    if (!existente) {
      throw new NotFoundException('Alerta no encontrada');
    }
    if (existente.reportePerdida.propietarioId !== userId) {
      throw new ForbiddenException(
        'Solo el dueño del reporte puede gestionar esta alerta',
      );
    }
    return existente;
  }

  async descartar(
    coincidenciaId: string,
    userId: string,
  ): Promise<AlertaResponse> {
    await this.buscarPropia(coincidenciaId, userId);

    const actualizada = await this.prisma.coincidencia.update({
      where: { id: coincidenciaId },
      data: { estado: EstadoCoincidencia.DESCARTADA },
      include: { reportePerdida: true, reporteEncontrada: true },
    });

    return this.toResponse(actualizada);
  }

  async marcarVista(
    coincidenciaId: string,
    userId: string,
  ): Promise<AlertaResponse> {
    await this.buscarPropia(coincidenciaId, userId);

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
