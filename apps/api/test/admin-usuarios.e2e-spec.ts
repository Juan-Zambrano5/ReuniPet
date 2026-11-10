import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  PASSWORD_PRUEBA,
  auth,
  crearUsuarioConSesion,
} from './helpers/sesion';

const EMAILS = {
  ana: 'ana-susp@test.dev',
  otro: 'otro-susp@test.dev',
  admin: 'admin-susp@test.dev',
};

// HU19: el administrador suspende y reactiva cuentas.
describe('HU19 — /admin/usuarios (suspender y reactivar)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids = { ana: '', otro: '', admin: '' };
  const tok = { ana: '', otro: '', admin: '' };
  let reporteAna: string;

  const http = () => request(app.getHttpServer());

  function cambiarActivo(id: string, token: string, body: unknown) {
    return http()
      .patch(`/admin/usuarios/${id}/activo`)
      .set(auth(token))
      .send(body as object);
  }

  function login(email: string, password = PASSWORD_PRUEBA) {
    return http().post('/auth/login').send({ email, password });
  }

  async function limpiar(): Promise<void> {
    const usuarios = await prisma.usuario.findMany({
      where: { email: { in: Object.values(EMAILS) } },
      select: { id: true },
    });
    const propietarioId = { in: usuarios.map((u) => u.id) };
    await prisma.coincidencia.deleteMany({
      where: {
        OR: [
          { reportePerdida: { propietarioId } },
          { reporteEncontrada: { propietarioId } },
        ],
      },
    });
    await prisma.reporte.deleteMany({ where: { propietarioId } });
    await prisma.usuario.deleteMany({ where: { id: propietarioId } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    await limpiar();
    for (const clave of ['ana', 'otro', 'admin'] as const) {
      const u = await crearUsuarioConSesion(app, prisma, {
        nombre: clave,
        email: EMAILS[clave],
      });
      ids[clave] = u.id;
      tok[clave] = u.token;
    }
    await prisma.usuario.update({
      where: { id: ids.admin },
      data: { rol: 'ADMIN' },
    });

    const res = await http()
      .post('/reportes')
      .set(auth(tok.ana))
      .send({
        tipo: 'PERDIDA',
        especie: 'Gato',
        color: 'gris',
        caracteristicasDistintivas: 'cola corta',
      })
      .expect(201);
    reporteAna = (res.body as { id: string }).id;
  });

  afterEach(async () => {
    // Cada prueba arranca con todos activos.
    await prisma.usuario.updateMany({
      where: { id: { in: Object.values(ids) } },
      data: { activo: true },
    });
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  describe('AC1: suspender', () => {
    it('login correcto → 403 CUENTA_SUSPENDIDA; incorrecto → 401 genérico', async () => {
      const res = await cambiarActivo(ids.ana, tok.admin, {
        activo: false,
      }).expect(200);
      expect(res.body).toMatchObject({ id: ids.ana, activo: false });

      const bien = await login(EMAILS.ana).expect(403);
      expect(bien.body).toMatchObject({
        code: 'CUENTA_SUSPENDIDA',
        message: 'Tu cuenta está suspendida',
      });
      expect(bien.body).not.toHaveProperty('token');

      const mal = await login(EMAILS.ana, 'otra-clave-123').expect(401);
      expect(mal.body).not.toHaveProperty('code');
      expect((mal.body as { message: string }).message).toBe(
        'Correo o contraseña incorrectos',
      );
    });

    it('un token emitido antes de suspender da 401 CUENTA_SUSPENDIDA en rutas privadas y públicas', async () => {
      await cambiarActivo(ids.ana, tok.admin, { activo: false }).expect(200);

      for (const ruta of ['/usuarios/me/reportes', '/reportes', `/reportes/${reporteAna}`]) {
        const res = await http().get(ruta).set(auth(tok.ana)).expect(401);
        expect(res.body).toMatchObject({ code: 'CUENTA_SUSPENDIDA' });
      }
    });

    it('sus reportes siguen en el listado público y en el detalle', async () => {
      await cambiarActivo(ids.ana, tok.admin, { activo: false }).expect(200);

      const lista = await http().get('/reportes').expect(200);
      expect(
        (lista.body as { items: { id: string }[] }).items.map((r) => r.id),
      ).toContain(reporteAna);
      await http().get(`/reportes/${reporteAna}`).set(auth(tok.otro)).expect(200);
    });

    it('no se suspende a un administrador ni a uno mismo (400); 404 si no existe; idempotente', async () => {
      const propio = await cambiarActivo(ids.admin, tok.admin, {
        activo: false,
      }).expect(400);
      expect((propio.body as { message: string }).message).toBe(
        'No puedes suspender tu propia cuenta',
      );

      const otroAdmin = await crearUsuarioConSesion(app, prisma, {
        nombre: 'Admin 2',
        email: 'admin2-susp@test.dev',
      });
      await prisma.usuario.update({
        where: { id: otroAdmin.id },
        data: { rol: 'ADMIN' },
      });
      try {
        const res = await cambiarActivo(otroAdmin.id, tok.admin, {
          activo: false,
        }).expect(400);
        expect((res.body as { message: string }).message).toBe(
          'No se puede suspender a un administrador',
        );
      } finally {
        await prisma.usuario.delete({ where: { id: otroAdmin.id } });
      }

      await cambiarActivo('00000000-0000-0000-0000-000000000000', tok.admin, {
        activo: false,
      }).expect(404);

      await cambiarActivo(ids.otro, tok.admin, { activo: true }).expect(200);
      await cambiarActivo(ids.ana, tok.admin, { activo: false }).expect(200);
      const repetido = await cambiarActivo(ids.ana, tok.admin, {
        activo: false,
      }).expect(200);
      expect(repetido.body).toMatchObject({ activo: false });
    });
  });

  describe('AC2: reactivar', () => {
    it('vuelve a entrar con su contraseña y ve sus reportes', async () => {
      await cambiarActivo(ids.ana, tok.admin, { activo: false }).expect(200);
      await cambiarActivo(ids.ana, tok.admin, { activo: true }).expect(200);

      const sesion = await login(EMAILS.ana).expect(200);
      const token = (sesion.body as { token: string }).token;
      const mios = await http()
        .get('/usuarios/me/reportes')
        .set(auth(token))
        .expect(200);
      expect((mios.body as { id: string }[]).map((r) => r.id)).toEqual([
        reporteAna,
      ]);
    });
  });

  describe('AC3: solo ADMIN', () => {
    it('sin token 401; USUARIO 403 aunque el body sea inválido', async () => {
      await http().get('/admin/usuarios').expect(401);
      await http()
        .patch(`/admin/usuarios/${ids.ana}/activo`)
        .send({ activo: false })
        .expect(401);

      await http().get('/admin/usuarios').set(auth(tok.otro)).expect(403);
      await cambiarActivo(ids.ana, tok.otro, { activo: false }).expect(403);
      await cambiarActivo(ids.ana, tok.otro, { activo: 'no' }).expect(403);
      const ana = await prisma.usuario.findUniqueOrThrow({
        where: { id: ids.ana },
      });
      expect(ana.activo).toBe(true);
    });

    it('un body inválido del ADMIN → 400', async () => {
      await cambiarActivo(ids.ana, tok.admin, { activo: 'no' }).expect(400);
      await cambiarActivo(ids.ana, tok.admin, {
        activo: false,
        rol: 'ADMIN',
      }).expect(400);
    });

    it('la lista trae estado y totalReportes, y nunca passwordHash', async () => {
      await cambiarActivo(ids.ana, tok.admin, { activo: false }).expect(200);

      const res = await http()
        .get('/admin/usuarios')
        .set(auth(tok.admin))
        .expect(200);
      const lista = res.body as Record<string, unknown>[];
      expect(lista.find((u) => u.id === ids.ana)).toEqual({
        id: ids.ana,
        nombre: 'ana',
        email: EMAILS.ana,
        rol: 'USUARIO',
        activo: false,
        createdAt: expect.any(String) as string,
        totalReportes: 1,
      });
      expect(lista.find((u) => u.id === ids.admin)).toMatchObject({
        rol: 'ADMIN',
        activo: true,
        totalReportes: 0,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|scrypt/);
    });
  });
});
