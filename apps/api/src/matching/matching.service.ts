import { Injectable, Logger } from '@nestjs/common';
import { Reporte } from '@prisma/client';
import { MATCH_THRESHOLD } from '@reunipet/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Normaliza texto: minúsculas, sin acentos, sin espacios extra. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Similitud de texto tolerante (0-1): combinación de igualdad exacta
 * normalizada y coeficiente de Dice sobre bigramas.
 */
export function similitud(a: string, b: string): number {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const bigramas = (s: string): string[] => {
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };

  const ga = bigramas(na);
  const gb = bigramas(nb);
  if (ga.length === 0 || gb.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const g of ga) counts.set(g, (counts.get(g) ?? 0) + 1);
  let intersection = 0;
  for (const g of gb) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      intersection += 1;
      counts.set(g, c - 1);
    }
  }
  return (2 * intersection) / (ga.length + gb.length);
}

export interface MatchResult {
  reportePerdidaId: string;
  reporteEncontradaId: string;
  score: number;
}

/**
 * Score ponderado HU5: especie 0.4 + raza 0.3 + color 0.3.
 * La especie ya pasó el filtro duro (garantizada).
 */
export function calcularScore(reporteA: Reporte, reporteB: Reporte): number {
  let score = 0.4;
  if (reporteA.raza && reporteB.raza && similitud(reporteA.raza, reporteB.raza) >= 0.7) {
    score += 0.3;
  }
  if (similitud(reporteA.color, reporteB.color) >= 0.7) {
    score += 0.3;
  }
  return score;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Se ejecuta automáticamente tras crear un reporte (HU5):
   * lo compara contra todos los reportes activos del tipo opuesto.
   */
  async compararReporte(reporteId: string): Promise<void> {
    const reporte = await this.prisma.reporte.findUnique({
      where: { id: reporteId },
    });
    if (!reporte) return;
    if (reporte.estado === 'RECUPERADA') return;

    const esPerdida = reporte.tipo === 'PERDIDA';
    const tipoOpuesto = esPerdida ? 'ENCONTRADA' : 'PERDIDA';

    const candidatos = await this.prisma.reporte.findMany({
      where: { tipo: tipoOpuesto, estado: { not: 'RECUPERADA' } },
    });

    for (const candidato of candidatos) {
      const par = esPerdida
        ? { perdida: reporte, encontrada: candidato }
        : { perdida: candidato, encontrada: reporte };

      const score = this.evaluarPar(par.perdida, par.encontrada);
      if (score === null) continue;

      await this.registrarCoincidencia(
        par.perdida.id,
        par.encontrada.id,
        score,
      );
    }
  }

  /** Filtro duro por especie + score; null si no hay coincidencia. */
  private evaluarPar(perdida: Reporte, encontrada: Reporte): number | null {
    // AC3 HU5: especie distinta → score 0 y NO se genera coincidencia
    if (normalizar(perdida.especie) !== normalizar(encontrada.especie)) {
      return null;
    }
    const score = calcularScore(perdida, encontrada);
    // AC1 HU5: posible coincidencia cuando score >= umbral
    return score >= MATCH_THRESHOLD ? score : null;
  }

  private async registrarCoincidencia(
    reportePerdidaId: string,
    reporteEncontradaId: string,
    score: number,
  ): Promise<void> {
    const existente = await this.prisma.coincidencia.findFirst({
      where: { reportePerdidaId, reporteEncontradaId },
    });
    if (existente) return;

    await this.prisma.coincidencia.create({
      data: { reportePerdidaId, reporteEncontradaId, score },
    });
    this.logger.log(
      `Coincidencia ${reportePerdidaId} ~ ${reporteEncontradaId} score=${score}`,
    );
  }
}
