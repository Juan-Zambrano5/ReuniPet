import { EstadoReporte, Usuario } from '@prisma/client';
import { MatchingService } from '../matching/matching.service';
import { ReportesService } from './reportes.service';

const user: Usuario = {
  id: 'user-1',
  nombre: 'Ana',
  email: 'ana@test.dev',
  telefono: null,
  passwordHash: null,
  rol: 'USUARIO',
  createdAt: new Date(),
};

function reporte(
  id: string,
  over: Record<string, unknown> = {},
  pendientes = 0,
): Record<string, unknown> {
  const fecha = new Date('2026-11-01T10:00:00Z');
  return {
    id,
    tipo: 'PERDIDA',
    especie: 'perro',
    raza: null,
    color: 'negro',
    caracteristicasDistintivas: 'collar',
    ubicacion: null,
    latitud: 4.711234,
    longitud: -74.072099,
    estado: 'PERDIDA',
    propietarioId: user.id,
    createdAt: fecha,
    updatedAt: fecha,
    fotos: [],
    _count: { coincidenciasComoPerdida: pendientes },
    ...over,
  };
}

describe('ReportesService.listMine (HU15)', () => {
  let service: ReportesService;
  let findMany: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    service = new ReportesService(
      { reporte: { findMany } } as never,
      { compararReporte: jest.fn() } as unknown as MatchingService,
    );
  });

  it('AC1/AC3: consulta solo los reportes del usuario, todos los estados, más reciente primero', async () => {
    await service.listMine(user);

    const args = findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      orderBy: unknown;
      include: { _count: { select: { coincidenciasComoPerdida: { where: unknown } } } };
    };
    // Sin filtro de estado: incluye los RECUPERADA.
    expect(args.where).toEqual({ propietarioId: user.id });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    // AC2: cuenta como /alertas — sin descartadas ni con la otra parte RECUPERADA.
    expect(args.include._count.select.coincidenciasComoPerdida.where).toEqual({
      estado: { in: ['PENDIENTE', 'VISTA'] },
      reporteEncontrada: { estado: { not: 'RECUPERADA' }, moderado: false },
    });
  });

  it('AC1: devuelve foto principal, estado y coordenadas exactas (es el propietario)', async () => {
    const foto = {
      id: 'f-1',
      reporteId: 'r-1',
      url: '/files/a.webp',
      orden: 0,
      createdAt: new Date('2026-11-01T10:00:00Z'),
    };
    findMany.mockResolvedValue([reporte('r-1', { fotos: [foto] }, 2)]);

    const [item] = await service.listMine(user);

    expect(item).toMatchObject({
      id: 'r-1',
      estado: 'PERDIDA',
      esPropietario: true,
      latitud: 4.711234,
      longitud: -74.072099,
      coincidenciasPendientes: 2,
      fotoPrincipal: { id: 'f-1', url: '/files/a.webp' },
    });
  });

  it('AC2: un reporte RECUPERADA no muestra coincidencias pendientes', async () => {
    findMany.mockResolvedValue([
      reporte('r-1', { estado: EstadoReporte.RECUPERADA }, 3),
    ]);
    const [item] = await service.listMine(user);
    expect(item.estado).toBe('RECUPERADA');
    expect(item.coincidenciasPendientes).toBe(0);
  });

  it('AC3: sin reportes devuelve una lista vacía', async () => {
    await expect(service.listMine(user)).resolves.toEqual([]);
  });
});
