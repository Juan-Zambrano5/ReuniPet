import { Reporte } from '@prisma/client';
import { MATCH_THRESHOLD } from '@reunipet/shared';
import {
  MatchingService,
  calcularScore,
  normalizar,
  similitud,
} from './matching.service';
import { PrismaService } from '../prisma/prisma.service';

function makeReporte(overrides: Partial<Reporte>): Reporte {
  const now = new Date();
  return {
    id: 'rep-x',
    tipo: 'PERDIDA',
    especie: 'Perro',
    raza: 'Labrador',
    color: 'Negro',
    caracteristicasDistintivas: 'collar rojo',
    ubicacion: null,
    estado: 'PERDIDA',
    propietarioId: 'user-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('MatchingService (HU5)', () => {
  describe('utilidades de texto', () => {
    it('normaliza mayúsculas, acentos y espacios', () => {
      expect(normalizar('  Perro  ')).toBe('perro');
      expect(normalizar('MÓRRONO')).toBe('morrono');
      expect(normalizar('PRECIOSA ')).toBe('preciosa');
    });

    it('similitud: exacta = 1, sin relación ≈ 0', () => {
      expect(similitud('Labrador', 'labrador')).toBe(1);
      expect(similitud('labrador', 'labrador')).toBe(1);
      expect(similitud('salchicha', 'labrador')).toBeLessThan(0.7);
    });
  });

  describe('calcularScore', () => {
    it('da 1.0 con especie + raza + color coincidentes', () => {
      const a = makeReporte({});
      const b = makeReporte({ tipo: 'ENCONTRADA' });
      expect(calcularScore(a, b)).toBeCloseTo(1.0);
    });

    it('da 0.7 con especie y color, sin raza coincidente', () => {
      const a = makeReporte({ raza: 'labrador' });
      const b = makeReporte({ raza: 'bulldog', color: 'negro' });
      expect(calcularScore(a, b)).toBeCloseTo(0.7);
    });

    it('queda bajo el umbral sin color ni raza', () => {
      const a = makeReporte({ color: 'negro', raza: 'labrador' });
      const b = makeReporte({ color: 'blanco', raza: 'bulldog' });
      expect(calcularScore(a, b)).toBeCloseTo(0.4);
      expect(calcularScore(a, b)).toBeLessThan(MATCH_THRESHOLD);
    });
  });

  describe('compararReporte', () => {
    let service: MatchingService;
    let prismaMock: {
      reporte: { findUnique: jest.Mock; findMany: jest.Mock };
      coincidencia: { findFirst: jest.Mock; create: jest.Mock };
    };

    const perdida = makeReporte({ id: 'per-1', tipo: 'PERDIDA' });
    const encontrada = makeReporte({
      id: 'enc-1',
      tipo: 'ENCONTRADA',
      estado: 'ENCONTRADA',
    });

    beforeEach(() => {
      prismaMock = {
        reporte: { findUnique: jest.fn(), findMany: jest.fn() },
        coincidencia: { findFirst: jest.fn(), create: jest.fn() },
      };
      service = new MatchingService(prismaMock as unknown as PrismaService);
    });

    it('AC1: genera coincidencia cuando hay alto porcentaje de coincidencia', async () => {
      prismaMock.reporte.findUnique.mockResolvedValue(perdida);
      prismaMock.reporte.findMany.mockResolvedValue([encontrada]);
      prismaMock.coincidencia.findFirst.mockResolvedValue(null);
      prismaMock.coincidencia.create.mockResolvedValue({});

      await service.compararReporte('per-1');

      expect(prismaMock.coincidencia.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reportePerdidaId: 'per-1',
          reporteEncontradaId: 'enc-1',
          score: 1,
        }),
      });
    });

    it('AC2: genera la coincidencia automáticamente al crear un nuevo reporte (encontrada recién creada)', async () => {
      prismaMock.reporte.findUnique.mockResolvedValue(encontrada);
      prismaMock.reporte.findMany.mockResolvedValue([perdida]);
      prismaMock.coincidencia.findFirst.mockResolvedValue(null);
      prismaMock.coincidencia.create.mockResolvedValue({});

      await service.compararReporte('enc-1');

      expect(prismaMock.coincidencia.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reportePerdidaId: 'per-1',
          reporteEncontradaId: 'enc-1',
        }),
      });
    });

    it('AC3: NO genera coincidencia cuando la especie difiere', async () => {
      const gatoEncontrado = makeReporte({
        id: 'enc-gato',
        tipo: 'ENCONTRADA',
        estado: 'ENCONTRADA',
        especie: 'Gato',
        color: 'negro',
        raza: 'labrador',
      });
      prismaMock.reporte.findUnique.mockResolvedValue(perdida);
      prismaMock.reporte.findMany.mockResolvedValue([gatoEncontrado]);

      await service.compararReporte('per-1');

      expect(prismaMock.coincidencia.create).not.toHaveBeenCalled();
    });

    it('no genera coincidencia cuando el score queda bajo el umbral', async () => {
      const distante = makeReporte({
        id: 'enc-2',
        tipo: 'ENCONTRADA',
        estado: 'ENCONTRADA',
        raza: 'bulldog',
        color: 'blanco',
      });
      prismaMock.reporte.findUnique.mockResolvedValue(perdida);
      prismaMock.reporte.findMany.mockResolvedValue([distante]);

      await service.compararReporte('per-1');

      expect(prismaMock.coincidencia.create).not.toHaveBeenCalled();
    });

    it('no duplica coincidencias existentes', async () => {
      prismaMock.reporte.findUnique.mockResolvedValue(perdida);
      prismaMock.reporte.findMany.mockResolvedValue([encontrada]);
      prismaMock.coincidencia.findFirst.mockResolvedValue({ id: 'coin-1' });

      await service.compararReporte('per-1');

      expect(prismaMock.coincidencia.create).not.toHaveBeenCalled();
    });

    it('solo compara contra reportes del tipo opuesto', async () => {
      prismaMock.reporte.findUnique.mockResolvedValue(perdida);
      prismaMock.reporte.findMany.mockResolvedValue([]);

      await service.compararReporte('per-1');

      expect(prismaMock.reporte.findMany).toHaveBeenCalledWith({
        where: { tipo: 'ENCONTRADA', estado: { not: 'RECUPERADA' } },
      });
    });
  });
});
