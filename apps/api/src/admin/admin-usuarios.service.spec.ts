import {
  BadRequestException,
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Usuario } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import { JwtCurrentUserProvider } from '../usuarios/current-user.provider';
import {
  AdminUsuariosService,
  NO_SUSPENDER_A_SI_MISMO,
  NO_SUSPENDER_ADMIN,
} from './admin-usuarios.service';

const fecha = new Date('2026-11-01T10:00:00.000Z');
const admin: Usuario = {
  id: 'admin-1',
  nombre: 'Admin',
  email: 'admin@test.dev',
  telefono: null,
  passwordHash: 'scrypt$x$y',
  rol: 'ADMIN',
  activo: true,
  createdAt: fecha,
};
const fila = (over: Partial<Usuario> = {}): object => ({
  id: 'u-1',
  nombre: 'Ana',
  email: 'ana@test.dev',
  rol: 'USUARIO',
  activo: true,
  createdAt: fecha,
  _count: { reportes: 3 },
  ...over,
});

describe('HU19 — AdminUsuariosService', () => {
  let service: AdminUsuariosService;
  let prisma: {
    usuario: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      usuario: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    service = new AdminUsuariosService(prisma as never);
  });

  it('AC3: lista estado y totalReportes sin pedir passwordHash', async () => {
    prisma.usuario.findMany.mockResolvedValue([fila()]);
    const res = await service.listar();
    expect(res).toEqual([
      {
        id: 'u-1',
        nombre: 'Ana',
        email: 'ana@test.dev',
        rol: 'USUARIO',
        activo: true,
        createdAt: fecha.toISOString(),
        totalReportes: 3,
      },
    ]);
    const { select } = prisma.usuario.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(select).not.toHaveProperty('passwordHash');
  });

  it('AC1: suspende a un usuario normal', async () => {
    prisma.usuario.findUnique.mockResolvedValue(fila());
    prisma.usuario.update.mockResolvedValue(fila({ activo: false }));
    await expect(service.cambiarActivo('u-1', false, admin)).resolves.toMatchObject({
      activo: false,
    });
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { activo: false } }),
    );
  });

  it('no se suspende a uno mismo (400)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(
      fila({ id: admin.id, rol: 'ADMIN' }),
    );
    await expect(service.cambiarActivo(admin.id, false, admin)).rejects.toThrow(
      new BadRequestException(NO_SUSPENDER_A_SI_MISMO),
    );
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('no se suspende a otro administrador (400)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(
      fila({ id: 'admin-2', rol: 'ADMIN' }),
    );
    await expect(service.cambiarActivo('admin-2', false, admin)).rejects.toThrow(
      new BadRequestException(NO_SUSPENDER_ADMIN),
    );
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('idempotente: si ya está en ese estado no escribe', async () => {
    prisma.usuario.findUnique.mockResolvedValue(fila({ activo: false }));
    await expect(service.cambiarActivo('u-1', false, admin)).resolves.toMatchObject({
      activo: false,
    });
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('usuario inexistente → 404', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(service.cambiarActivo('x', true, admin)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('HU19 — AdminGuard con un usuario suspendido', () => {
  it('rechaza su token vigente con 401 CUENTA_SUSPENDIDA (aunque sea ADMIN)', async () => {
    // Proveedor real: el guard resuelve el usuario y ve activo=false.
    const provider = new JwtCurrentUserProvider(
      {
        usuario: {
          findUnique: jest.fn().mockResolvedValue({ ...admin, activo: false }),
        },
      } as never,
      { verificar: jest.fn().mockResolvedValue(admin.id) } as never,
    );
    const guard = new AdminGuard(provider);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer valido' } }),
      }),
    } as ExecutionContext;

    const err: unknown = await guard.canActivate(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as UnauthorizedException).getResponse()).toMatchObject({
      code: 'CUENTA_SUSPENDIDA',
    });
  });
});
