import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TipoReporte } from '@reunipet/shared';
import { ReportesService } from './reportes.service';
import { CreateReporteDto } from './dto/create-reporte.dto';
import { MatchingService } from '../matching/matching.service';
import { Usuario } from '@prisma/client';

const user: Usuario = {
  id: 'user-1',
  nombre: 'Demo',
  email: 'demo@reunipet.app',
  telefono: null,
  createdAt: new Date(),
};

describe('ReportesService', () => {
  let service: ReportesService;
  let prismaMock: { reporte: { create: jest.Mock } };
  let matchingMock: { compararReporte: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      reporte: { create: jest.fn() },
    };
    matchingMock = { compararReporte: jest.fn().mockResolvedValue(undefined) };
    service = new ReportesService(
      prismaMock as never,
      matchingMock as MatchingService,
    );
  });

  it('crea un reporte PERDIDA con estado PERDIDA y dispara el hook de matching (caso feliz)', async () => {
    const now = new Date();
    const created = {
      id: 'rep-1',
      tipo: 'PERDIDA',
      especie: 'perro',
      raza: 'labrador',
      color: 'negro',
      caracteristicasDistintivas: 'collar rojo',
      ubicacion: null,
      estado: 'PERDIDA',
      propietarioId: user.id,
      createdAt: now,
      updatedAt: now,
    };
    prismaMock.reporte.create.mockResolvedValue(created);

    const dto: CreateReporteDto = {
      tipo: TipoReporte.PERDIDA,
      especie: 'perro',
      raza: 'labrador',
      color: 'negro',
      caracteristicasDistintivas: 'collar rojo',
    };

    const result = await service.create(dto, user);

    expect(prismaMock.reporte.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'PERDIDA',
        estado: 'PERDIDA',
        propietarioId: user.id,
        especie: 'perro',
        color: 'negro',
      }),
    });
    expect(matchingMock.compararReporte).toHaveBeenCalledWith('rep-1');
    expect(result.id).toBe('rep-1');
    expect(result.estado).toBe('PERDIDA');
  });

  it('rechaza un DTO con campo obligatorio faltante (color)', async () => {
    const dto = plainToInstance(CreateReporteDto, {
      tipo: 'PERDIDA',
      especie: 'perro',
      caracteristicasDistintivas: 'collar rojo',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'color')).toBe(true);
  });

  it('rechaza un DTO sin especie', async () => {
    const dto = plainToInstance(CreateReporteDto, {
      tipo: 'PERDIDA',
      color: 'negro',
      caracteristicasDistintivas: 'collar rojo',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'especie')).toBe(true);
  });
});
