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
  let prismaMock: {
    reporte: {
      create: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let matchingMock: { compararReporte: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      reporte: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    matchingMock = { compararReporte: jest.fn().mockResolvedValue(undefined) };
    service = new ReportesService(
      prismaMock as never,
      matchingMock as unknown as MatchingService,
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

  it('HU3: para tipo ENCONTRADA la ubicación es obligatoria', async () => {
    const dto = plainToInstance(CreateReporteDto, {
      tipo: 'ENCONTRADA',
      especie: 'gato',
      color: 'blanco',
      caracteristicasDistintivas: 'sin cola',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ubicacion')).toBe(true);
  });

  it('HU3: para tipo PERDIDA la ubicación sigue siendo opcional', async () => {
    const dto = plainToInstance(CreateReporteDto, {
      tipo: 'PERDIDA',
      especie: 'gato',
      color: 'blanco',
      caracteristicasDistintivas: 'sin cola',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('HU3: crea un reporte ENCONTRADA con estado ENCONTRADA', async () => {
    const now = new Date();
    prismaMock.reporte.create.mockResolvedValue({
      id: 'rep-2',
      tipo: 'ENCONTRADA',
      especie: 'gato',
      raza: null,
      color: 'blanco',
      caracteristicasDistintivas: 'sin cola',
      ubicacion: 'Parque Central',
      estado: 'ENCONTRADA',
      propietarioId: user.id,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.create(
      {
        tipo: TipoReporte.ENCONTRADA,
        especie: 'gato',
        color: 'blanco',
        caracteristicasDistintivas: 'sin cola',
        ubicacion: 'Parque Central',
      },
      user,
    );

    expect(prismaMock.reporte.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'ENCONTRADA',
        estado: 'ENCONTRADA',
        ubicacion: 'Parque Central',
      }),
    });
    expect(result.estado).toBe('ENCONTRADA');
    expect(result.ubicacion).toBe('Parque Central');
  });

  describe('list (HU6)', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');

    const reporteAjeno = {
      id: 'rep-1',
      tipo: 'PERDIDA',
      especie: 'Perro',
      raza: 'Labrador',
      color: 'negro',
      caracteristicasDistintivas: 'collar rojo',
      ubicacion: 'Parque Central',
      latitud: 10.12345,
      longitud: -66.98765,
      estado: 'PERDIDA',
      propietarioId: 'user-otro',
      createdAt: now,
      updatedAt: now,
      fotos: [
        {
          id: 'f-1',
          reporteId: 'rep-1',
          url: '/files/perro.jpg',
          orden: 0,
          createdAt: now,
        },
      ],
    };

    it('AC1: lista los reportes PERDIDA con foto principal, especie, raza y fecha', async () => {
      prismaMock.reporte.count.mockResolvedValue(1);
      prismaMock.reporte.findMany.mockResolvedValue([reporteAjeno]);

      const result = await service.list({}, user);

      expect(prismaMock.reporte.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tipo: 'PERDIDA', estado: { not: 'RECUPERADA' } },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      const item = result.items[0];
      expect(item).toMatchObject({
        id: 'rep-1',
        tipo: 'PERDIDA',
        especie: 'Perro',
        raza: 'Labrador',
        color: 'negro',
        estado: 'PERDIDA',
        ubicacion: 'Parque Central',
        esPropietario: false,
      });
      expect(item.fotoPrincipal).toMatchObject({ url: '/files/perro.jpg' });
      expect(item.createdAt).toBe(now.toISOString());
    });

    it('AC3/HU9: a un usuario que no es el propietario le sirve la ubicación aproximada', async () => {
      prismaMock.reporte.count.mockResolvedValue(1);
      prismaMock.reporte.findMany.mockResolvedValue([reporteAjeno]);

      const result = await service.list({}, user);

      // ~1km: 10.12345 → 10.12, -66.98765 → -66.99
      expect(result.items[0].latitud).toBe(10.12);
      expect(result.items[0].longitud).toBe(-66.99);
      expect(result.items[0].esPropietario).toBe(false);
    });

    it('al propietario le sirve la ubicación exacta', async () => {
      prismaMock.reporte.count.mockResolvedValue(1);
      prismaMock.reporte.findMany.mockResolvedValue([
        { ...reporteAjeno, propietarioId: user.id },
      ]);

      const result = await service.list({}, user);

      expect(result.items[0].latitud).toBe(10.12345);
      expect(result.items[0].longitud).toBe(-66.98765);
      expect(result.items[0].esPropietario).toBe(true);
    });

    it('AC2: sin reportes devuelve items vacío y total 0', async () => {
      prismaMock.reporte.count.mockResolvedValue(0);
      prismaMock.reporte.findMany.mockResolvedValue([]);

      const result = await service.list({}, user);

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('aplica paginación con page/limit y los refleja en meta', async () => {
      prismaMock.reporte.count.mockResolvedValue(7);
      prismaMock.reporte.findMany.mockResolvedValue([reporteAjeno]);

      const result = await service.list(
        { tipo: TipoReporte.PERDIDA, page: 2, limit: 5 },
        user,
      );

      expect(prismaMock.reporte.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        total: 7,
        totalPages: 2,
      });
    });
  });
});
