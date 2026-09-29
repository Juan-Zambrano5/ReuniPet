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
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let matchingMock: { compararReporte: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      reporte: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
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

      const result = await service.list(
        { tipo: TipoReporte.PERDIDA },
        user,
      );

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

    it('HU7 AC1: con tipo=ENCONTRADA filtra solo reportes encontrados', async () => {
      prismaMock.reporte.count.mockResolvedValue(1);
      prismaMock.reporte.findMany.mockResolvedValue([
        { ...reporteAjeno, tipo: 'ENCONTRADA', estado: 'ENCONTRADA' },
      ]);

      const result = await service.list(
        { tipo: TipoReporte.ENCONTRADA },
        user,
      );

      expect(prismaMock.reporte.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tipo: 'ENCONTRADA', estado: { not: 'RECUPERADA' } },
        }),
      );
      expect(result.items[0].tipo).toBe('ENCONTRADA');
      expect(result.items[0].estado).toBe('ENCONTRADA');
    });

    it('HU7: sin tipo no filtra por tipo (muestra ambos)', async () => {
      prismaMock.reporte.count.mockResolvedValue(2);
      prismaMock.reporte.findMany.mockResolvedValue([]);

      await service.list({}, user);

      const args = prismaMock.reporte.findMany.mock.calls[0][0];
      expect(args.where.tipo).toBeUndefined();
    });
  });

  describe('list (HU8 — filtros combinados)', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');

    // Forma del `select` de la consulta de candidatos (campos escalares).
    const candidatos = [
      {
        id: 'rep-perro-negro',
        especie: 'Perro',
        raza: 'Labrador',
        color: 'Negro',
        latitud: 10.01,
        longitud: -66.0,
      },
      {
        id: 'rep-perro-marron',
        especie: 'Perro',
        raza: 'Mestizo',
        color: 'Marrón',
        latitud: 10.1,
        longitud: -66.0,
      },
      {
        id: 'rep-gato-negro',
        especie: 'Gato',
        raza: null,
        color: 'Negro',
        latitud: null,
        longitud: null,
      },
    ];

    const completo = (c: (typeof candidatos)[number]) => ({
      ...c,
      tipo: 'PERDIDA',
      caracteristicasDistintivas: '',
      ubicacion: 'Parque Central',
      estado: 'PERDIDA',
      propietarioId: 'user-otro',
      createdAt: now,
      updatedAt: now,
      fotos: [],
    });

    /** Simula el camino con filtros: 1ª llamada = candidatos, 2ª = página. */
    function mockConFiltros(paginaIds: string[]) {
      prismaMock.reporte.findMany
        .mockResolvedValueOnce(candidatos)
        .mockResolvedValueOnce(
          candidatos.filter((c) => paginaIds.includes(c.id)).map(completo),
        );
    }

    it('AC1: combina especie y color con lógica AND', async () => {
      mockConFiltros(['rep-perro-negro']);

      const result = await service.list(
        { especie: 'perro', color: 'negro' },
        user,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('rep-perro-negro');
      expect(result.meta.total).toBe(1);
    });

    it('AC1: un filtro que solo cumple un reporte no trae los que fallan otro filtro', async () => {
      mockConFiltros([]);

      const result = await service.list(
        { especie: 'perro', color: 'negro', raza: 'pastor' },
        user,
      );

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('HU8: el filtro de color es tolerante a mayúsculas y acentos', async () => {
      mockConFiltros(['rep-perro-marron']);

      const result = await service.list({ color: 'MARRON' }, user);

      expect(result.items.map((i) => i.id)).toEqual(['rep-perro-marron']);
    });

    it('HU8: la especie "gato" tampoco matchea "Gato" con acentos de por medio', async () => {
      mockConFiltros(['rep-gato-negro']);

      const result = await service.list({ especie: 'GATO' }, user);

      expect(result.items.map((i) => i.id)).toEqual(['rep-gato-negro']);
    });

    it('HU8: filtrar por raza excluye los reportes sin raza', async () => {
      mockConFiltros(['rep-perro-negro']);

      const result = await service.list({ raza: 'labrador' }, user);

      expect(result.items.map((i) => i.id)).toEqual(['rep-perro-negro']);
    });

    it('HU8: Haversine incluye reportes dentro del radio y excluye los de afuera', async () => {
      // Centro (10,-66): rep-perro-negro ~1.1km (dentro de 5),
      // rep-perro-marron ~11.1km (fuera), rep-gato-negro sin coords (fuera).
      mockConFiltros(['rep-perro-negro']);

      const result = await service.list(
        { lat: 10, lng: -66, radioKm: 5 },
        user,
      );

      expect(result.items.map((i) => i.id)).toEqual(['rep-perro-negro']);
      expect(result.meta.total).toBe(1);
    });

    it('HU8: con radio amplio entra el reporte que estaba fuera', async () => {
      mockConFiltros(['rep-perro-negro', 'rep-perro-marron']);

      const result = await service.list(
        { lat: 10, lng: -66, radioKm: 50 },
        user,
      );

      expect(result.items.map((i) => i.id)).toEqual([
        'rep-perro-negro',
        'rep-perro-marron',
      ]);
    });

    it('HU8: lat/lng/radioKm deben enviarse juntos (400 si falta alguno)', async () => {
      await expect(service.list({ lat: 10 }, user)).rejects.toThrow(
        'lat, lng y radioKm deben enviarse juntos',
      );
      await expect(
        service.list({ lat: 10, radioKm: 5 }, user),
      ).rejects.toThrow('lat, lng y radioKm deben enviarse juntos');
      await expect(service.list({ lng: -66 }, user)).rejects.toThrow(
        'lat, lng y radioKm deben enviarse juntos',
      );
      expect(prismaMock.reporte.findMany).not.toHaveBeenCalled();
    });

    it('HU8: pagina sobre el resultado filtrado y refleja el total real', async () => {
      prismaMock.reporte.findMany
        .mockResolvedValueOnce(candidatos)
        .mockResolvedValueOnce([completo(candidatos[0]), completo(candidatos[2])]);

      const result = await service.list({ color: 'negro', limit: 2 }, user);

      // 2 coincidencias de color negro (perro y gato), limit 2 → 1 página.
      expect(result.meta).toEqual({
        page: 1,
        limit: 2,
        total: 2,
        totalPages: 1,
      });
      expect(prismaMock.reporte.count).not.toHaveBeenCalled();

      prismaMock.reporte.findMany
        .mockResolvedValueOnce(candidatos)
        .mockResolvedValueOnce([]);

      const pagina2 = await service.list(
        { color: 'negro', page: 2, limit: 2 },
        user,
      );
      expect(pagina2.items).toEqual([]);
      expect(pagina2.meta).toEqual({
        page: 2,
        limit: 2,
        total: 2,
        totalPages: 1,
      });
    });

    it('HU8: el orden devuelto respeta el orden original (más recientes primero)', async () => {
      prismaMock.reporte.findMany
        .mockResolvedValueOnce(candidatos)
        // La BD devuelve desordenado para forzar el re-orden por paginaIds.
        .mockResolvedValueOnce([
          completo(candidatos[2]),
          completo(candidatos[0]),
        ]);

      const result = await service.list({ color: 'negro' }, user);

      expect(result.items.map((i) => i.id)).toEqual([
        'rep-perro-negro',
        'rep-gato-negro',
      ]);
    });
  });

  describe('HU9 — ubicación (coordenadas)', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');
    const reporteBase = {
      id: 'rep-9',
      tipo: 'PERDIDA',
      especie: 'Perro',
      raza: null,
      color: 'negro',
      caracteristicasDistintivas: 'collar',
      ubicacion: 'Parque Central',
      latitud: 10.12345,
      longitud: -66.98765,
      estado: 'PERDIDA',
      propietarioId: user.id,
      createdAt: now,
      updatedAt: now,
    };

    it('AC2: create guarda latitud/longitud cuando vienen en par', async () => {
      prismaMock.reporte.create.mockResolvedValue({
        ...reporteBase,
        fotos: [],
      });

      const result = await service.create(
        {
          tipo: TipoReporte.PERDIDA,
          especie: 'Perro',
          color: 'negro',
          caracteristicasDistintivas: 'collar',
          latitud: 10.12345,
          longitud: -66.98765,
        },
        user,
      );

      expect(prismaMock.reporte.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          latitud: 10.12345,
          longitud: -66.98765,
        }),
      });
      // Quien crea es el propietario: ve sus coordenadas exactas.
      expect(result.latitud).toBe(10.12345);
      expect(result.longitud).toBe(-66.98765);
      expect(result.esPropietario).toBe(true);
    });

    it('AC2: create rechaza latitud sin longitud (las dos van en par)', async () => {
      await expect(
        service.create(
          {
            tipo: TipoReporte.PERDIDA,
            especie: 'Perro',
            color: 'negro',
            caracteristicasDistintivas: 'collar',
            latitud: 10,
          },
          user,
        ),
      ).rejects.toThrow('latitud y longitud deben enviarse juntas');
      expect(prismaMock.reporte.create).not.toHaveBeenCalled();
    });

    it('HU9: el DTO de creación valida rangos de latitud y longitud', async () => {
      const dto = plainToInstance(CreateReporteDto, {
        tipo: 'PERDIDA',
        especie: 'Perro',
        color: 'negro',
        caracteristicasDistintivas: 'collar',
        latitud: 100,
        longitud: -66,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'latitud')).toBe(true);

      const dtoLng = plainToInstance(CreateReporteDto, {
        tipo: 'PERDIDA',
        especie: 'Perro',
        color: 'negro',
        caracteristicasDistintivas: 'collar',
        latitud: 10,
        longitud: -200,
      });
      const errorsLng = await validate(dtoLng);
      expect(errorsLng.some((e) => e.property === 'longitud')).toBe(true);
    });

    it('AC3: findById entrega coordenadas exactas al propietario', async () => {
      prismaMock.reporte.findUnique.mockResolvedValue({
        ...reporteBase,
        fotos: [],
      });

      const result = await service.findById('rep-9', user.id);

      expect(result?.latitud).toBe(10.12345);
      expect(result?.longitud).toBe(-66.98765);
      expect(result?.esPropietario).toBe(true);
    });

    it('AC3: findById aproxima las coordenadas para un tercero', async () => {
      prismaMock.reporte.findUnique.mockResolvedValue({
        ...reporteBase,
        fotos: [],
      });

      const result = await service.findById('rep-9', 'otro-usuario');

      expect(result?.latitud).toBe(10.12);
      expect(result?.longitud).toBe(-66.99);
      expect(result?.esPropietario).toBe(false);
    });

    it('findById devuelve null cuando el reporte no existe', async () => {
      prismaMock.reporte.findUnique.mockResolvedValue(null);
      expect(await service.findById('no-existe', user.id)).toBeNull();
    });

    it('HU9: updateUbicacion responde 404 si el reporte no existe', async () => {
      prismaMock.reporte.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUbicacion('no-existe', { latitud: 10, longitud: -66 }, user),
      ).rejects.toThrow('Reporte no encontrado');
      expect(prismaMock.reporte.update).not.toHaveBeenCalled();
    });

    it('HU9: updateUbicacion prohíbe actualizar el reporte de otro usuario', async () => {
      prismaMock.reporte.findUnique.mockResolvedValue({
        ...reporteBase,
        propietarioId: 'dueno-real',
      });

      await expect(
        service.updateUbicacion('rep-9', { latitud: 10, longitud: -66 }, user),
      ).rejects.toThrow('Solo el propietario puede actualizar la ubicación');
      expect(prismaMock.reporte.update).not.toHaveBeenCalled();
    });

    it('HU9: el propietario actualiza lat/long y opcionalmente el texto', async () => {
      prismaMock.reporte.findUnique.mockResolvedValue(reporteBase);
      prismaMock.reporte.update.mockResolvedValue({
        ...reporteBase,
        latitud: 10.5,
        longitud: -66.4,
        ubicacion: 'Calle 5 con Av. Central',
      });

      const result = await service.updateUbicacion(
        'rep-9',
        { latitud: 10.5, longitud: -66.4, ubicacion: 'Calle 5 con Av. Central' },
        user,
      );

      expect(prismaMock.reporte.update).toHaveBeenCalledWith({
        where: { id: 'rep-9' },
        data: {
          latitud: 10.5,
          longitud: -66.4,
          ubicacion: 'Calle 5 con Av. Central',
        },
      });
      expect(result.latitud).toBe(10.5);
      expect(result.longitud).toBe(-66.4);
      expect(result.ubicacion).toBe('Calle 5 con Av. Central');
      expect(result.esPropietario).toBe(true);
    });

    it('HU9: sin texto en el DTO no se modifica el campo de referencia', async () => {
      prismaMock.reporte.findUnique.mockResolvedValue(reporteBase);
      prismaMock.reporte.update.mockResolvedValue({
        ...reporteBase,
        latitud: 11,
        longitud: -67,
      });

      await service.updateUbicacion(
        'rep-9',
        { latitud: 11, longitud: -67 },
        user,
      );

      expect(prismaMock.reporte.update).toHaveBeenCalledWith({
        where: { id: 'rep-9' },
        data: { latitud: 11, longitud: -67 },
      });
    });
  });
});
