import { Injectable } from '@nestjs/common';

@Injectable()
export class MatchingService {
  /**
   * Hook de matching (HU5). Se dispara tras crear un reporte.
   * La implementación completa del algoritmo llega con HU5.
   */
  async compararReporte(_reporteId: string): Promise<void> {
    // Pendiente: HU5
  }
}
