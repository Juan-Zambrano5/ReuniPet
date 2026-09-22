import { NotFoundException } from '@nestjs/common';
import { AlertasService } from './alertas.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AlertasService (HU4)', () => {
  let service: AlertasService;
  let prismaMock: {
    coincidencia: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };

  const baseCoincidencia = {
    id: 'coin-1',
    score: 0.9,
    estado: 'PENDIENTE',
    createdAt: new Date('2026-09-22T10:00:00Z'),
    reportePerdida: {
      id: 'per-1',
      especie: 'Perro',
      raza: 'Labrador',
      color: 'Negro',
      caracteristicasDistintivas: 'collar rojo',
      propietarioId: 'user-1',
    },
    reporteEncontrada: {
      id: 'enc-1',
      especie: 'Perro',
      raza: 'Labrador',
      color: 'Negro',
      ubicacion: 'Parque Central',
    },
  };

  beforeEach(() => {
    prismaMock = {
      coincidencia: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new AlertasService(prismaMock as unknown as PrismaService);
  });

  it('AC1/AC2: lista alertas del propietario del reporte PERDIDA con datos para el mensaje', async () => {
    prismaMock.coincidencia.findMany.mockResolvedValue([baseCoincidencia]);

    const alertas = await service.getAlertasDeUsuario('user-1');

    expect(prismaMock.coincidencia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: { in: ['PENDIENTE', 'VISTA'] },
          reportePerdida: { propietarioId: 'user-1' },
        }),
      }),
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      coincidenciaId: 'coin-1',
      score: 0.9,
      reportePerdida: { id: 'per-1', especie: 'Perro' },
      reporteEncontrada: { id: 'enc-1', ubicacion: 'Parque Central' },
    });
  });

  it('AC3: marcarVista cambia el estado a VISTA', async () => {
    prismaMock.coincidencia.findUnique.mockResolvedValue(baseCoincidencia);
    prismaMock.coincidencia.update.mockResolvedValue({
      ...baseCoincidencia,
      estado: 'VISTA',
    });

    const result = await service.marcarVista('coin-1');

    expect(prismaMock.coincidencia.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'coin-1' },
        data: { estado: 'VISTA' },
      }),
    );
    expect(result.estado).toBe('VISTA');
  });

  it('marcarVista lanza 404 si la alerta no existe', async () => {
    prismaMock.coincidencia.findUnique.mockResolvedValue(null);
    await expect(service.marcarVista('no-existe')).rejects.toThrow(
      NotFoundException,
    );
  });
});
