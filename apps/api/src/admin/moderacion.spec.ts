import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Usuario } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import { MatchingService } from '../matching/matching.service';
import { ReportesService } from '../reportes/reportes.service';
import { ModeracionDto } from './dto/moderacion.dto';

const fecha = new Date('2026-11-01T10:00:00.000Z');
const admin: Usuario = {
  id: 'admin-1',
  nombre: 'Admin',
  email: 'admin@test.dev',
  telefono: null,
  passwordHash: null,
  rol: 'ADMIN',
  createdAt: fecha,
};
const reporte = {
  id: 'rep-1',
  tipo: 'PERDIDA',
  especie: 'perro',
  raza: null,
  color: 'negro',
  caracteristicasDistintivas: 'collar',
  ubicacion: null,
  latitud: null,
  longitud: null,
  estado: 'PERDIDA',
  moderado: false,
  motivoModeracion: null,
  propietarioId: 'dueno-1',
  createdAt: fecha,
  updatedAt: fecha,
};
const conInclude = (r: object): object => ({
  ...r,
  fotos: [],
  propietario: { nombre: 'Ana', email: 'ana@test.dev' },
});

describe('HU18 — moderación de reportes', () => {
  let service: ReportesService;
  let prisma: {
    reporte: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    contactoSolicitud: { create: jest.Mock };
  };
  let comparar: jest.Mock;

  beforeEach(() => {
    prisma = {
      reporte: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      contactoSolicitud: { create: jest.fn() },
    };
    comparar = jest.fn().mockResolvedValue(undefined);
    service = new ReportesService(prisma as never, {
      compararReporte: comparar,
    } as unknown as MatchingService);
  });

  it('AC1: ocultar guarda el motivo y no recalcula coincidencias', async () => {
    prisma.reporte.findUnique.mockResolvedValue(reporte);
    prisma.reporte.update.mockResolvedValue(
      conInclude({ ...reporte, moderado: true, motivoModeracion: 'Duplicado' }),
    );

    const res = await service.moderar('rep-1', true, 'Duplicado', admin);

    expect(prisma.reporte.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { moderado: true, motivoModeracion: 'Duplicado' },
      }),
    );
    expect(res).toMatchObject({
      moderado: true,
      motivoModeracion: 'Duplicado',
      propietarioNombre: 'Ana',
      propietarioEmail: 'ana@test.dev',
    });
    expect(comparar).not.toHaveBeenCalled();
  });

  it('AC2: restaurar borra el motivo y vuelve a comparar', async () => {
    prisma.reporte.findUnique.mockResolvedValue({
      ...reporte,
      moderado: true,
      motivoModeracion: 'Duplicado',
    });
    prisma.reporte.update.mockResolvedValue(conInclude(reporte));

    await service.moderar('rep-1', false, 'ignorado', admin);

    expect(prisma.reporte.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { moderado: false, motivoModeracion: null },
      }),
    );
    expect(comparar).toHaveBeenCalledWith('rep-1');
  });

  it('moderar un reporte que no existe → 404', async () => {
    prisma.reporte.findUnique.mockResolvedValue(null);
    await expect(service.moderar('x', true, 'm', admin)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.reporte.update).not.toHaveBeenCalled();
  });

  it('listAdmin con moderados=true filtra solo los ocultos', async () => {
    prisma.reporte.findMany.mockResolvedValue([]);
    await service.listAdmin(true, admin);
    expect(prisma.reporte.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { moderado: true } }),
    );
    await service.listAdmin(false, admin);
    expect(prisma.reporte.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  describe('detalle de un reporte oculto', () => {
    beforeEach(() => {
      prisma.reporte.findUnique.mockResolvedValue({
        ...reporte,
        moderado: true,
        motivoModeracion: 'Inapropiado',
        fotos: [],
      });
    });

    it('un tercero o un anónimo no lo ven (null → 404)', async () => {
      expect(await service.findById('rep-1', 'otro')).toBeNull();
      expect(await service.findById('rep-1', null)).toBeNull();
    });

    it('AC1: el dueño lo ve con su motivo', async () => {
      const res = await service.findById('rep-1', 'dueno-1');
      expect(res).toMatchObject({
        moderado: true,
        motivoModeracion: 'Inapropiado',
        esPropietario: true,
      });
    });

    it('el administrador lo ve', async () => {
      expect(await service.findById('rep-1', admin.id, true)).not.toBeNull();
    });

    it('el contacto de un reporte oculto → 404 sin registrar la solicitud', async () => {
      await expect(service.getContacto('rep-1', admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.contactoSolicitud.create).not.toHaveBeenCalled();
    });
  });
});

describe('HU18 AC3 — AdminGuard', () => {
  const contexto = (req: object): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as ExecutionContext;

  it('sin sesión → 401', async () => {
    const guard = new AdminGuard({
      getUser: jest.fn().mockRejectedValue(new UnauthorizedException()),
    } as never);
    await expect(guard.canActivate(contexto({}))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('usuario sin rol ADMIN → 403', async () => {
    const guard = new AdminGuard({
      getUser: jest.fn().mockResolvedValue({ ...admin, rol: 'USUARIO' }),
    } as never);
    await expect(guard.canActivate(contexto({}))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('ADMIN pasa y queda en req.admin', async () => {
    const guard = new AdminGuard({
      getUser: jest.fn().mockResolvedValue(admin),
    } as never);
    const req: { admin?: Usuario } = {};
    await expect(guard.canActivate(contexto(req))).resolves.toBe(true);
    expect(req.admin).toBe(admin);
  });
});

describe('ModeracionDto (ValidationPipe global)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const validar = (body: Record<string, unknown>): Promise<unknown> =>
    pipe.transform(body, { type: 'body', metatype: ModeracionDto });

  it.each([
    ['ocultar sin motivo', { moderado: true }],
    ['ocultar con motivo vacío', { moderado: true, motivo: '   ' }],
    ['moderado no booleano', { moderado: 'si', motivo: 'x' }],
    ['campos extra', { moderado: false, estado: 'RECUPERADA' }],
  ])('%s → 400', async (_caso, body) => {
    await expect(validar(body)).rejects.toThrow(BadRequestException);
  });

  it('acepta ocultar con motivo (recortado) y restaurar sin motivo', async () => {
    await expect(
      validar({ moderado: true, motivo: '  Duplicado ' }),
    ).resolves.toMatchObject({ moderado: true, motivo: 'Duplicado' });
    await expect(validar({ moderado: false })).resolves.toMatchObject({
      moderado: false,
    });
  });
});
