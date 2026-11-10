import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { auth, crearUsuarioConSesion } from './helpers/sesion';

const EMAILS = {
  dueno: 'dueno-mod@test.dev',
  encontro: 'encontro-mod@test.dev',
  otro: 'otro-mod@test.dev',
  admin: 'admin-mod@test.dev',
};

const PERRO = {
  especie: 'Perro',
  raza: 'Labrador',
  color: 'negro',
  caracteristicasDistintivas: 'collar rojo',
  ubicacion: 'Parque Central',
};

// HU18: el administrador oculta y restaura reportes.
describe('HU18 — /admin/reportes (ocultar y restaurar)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tok = { dueno: '', encontro: '', otro: '', admin: '' };
  let perdidaId: string;
  let encontradaId: string;

  const http = () => request(app.getHttpServer());

  async function limpiar(): Promise<void> {
    await prisma.coincidencia.deleteMany();
    await prisma.contactoSolicitud.deleteMany();
    await prisma.fotografia.deleteMany();
    await prisma.reporte.deleteMany();
    await prisma.usuario.deleteMany({
      where: { email: { in: Object.values(EMAILS) } },
    });
  }

  async function crearReporte(
    token: string,
    tipo: 'PERDIDA' | 'ENCONTRADA',
  ): Promise<string> {
    const res = await http()
      .post('/reportes')
      .set(auth(token))
      .send({ ...PERRO, tipo })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  function moderar(id: string, token: string, body: Record<string, unknown>) {
    return http()
      .patch(`/admin/reportes/${id}/moderacion`)
      .set(auth(token))
      .send(body);
  }

  async function idsListado(query = ''): Promise<string[]> {
    const res = await http().get(`/reportes${query}`).expect(200);
    return (res.body as { items: { id: string }[] }).items.map((r) => r.id);
  }

  async function alertasDelDueno(): Promise<string[]> {
    const res = await http()
      .get('/usuarios/me/alertas')
      .set(auth(tok.dueno))
      .expect(200);
    return (res.body as { reporteEncontrada: { id: string } }[]).map(
      (a) => a.reporteEncontrada.id,
    );
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
    for (const clave of ['dueno', 'encontro', 'otro', 'admin'] as const) {
      const u = await crearUsuarioConSesion(app, prisma, {
        nombre: clave,
        email: EMAILS[clave],
      });
      tok[clave] = u.token;
      if (clave === 'admin') {
        await prisma.usuario.update({
          where: { id: u.id },
          data: { rol: 'ADMIN' },
        });
      }
    }
  });

  beforeEach(async () => {
    await prisma.coincidencia.deleteMany();
    await prisma.contactoSolicitud.deleteMany();
    await prisma.reporte.deleteMany();
    perdidaId = await crearReporte(tok.dueno, 'PERDIDA');
    encontradaId = await crearReporte(tok.encontro, 'ENCONTRADA');
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  describe('AC3: solo ADMIN', () => {
    it('sin sesión → 401 en los dos endpoints', async () => {
      await http().get('/admin/reportes').expect(401);
      await http()
        .patch(`/admin/reportes/${encontradaId}/moderacion`)
        .send({ moderado: true, motivo: 'x' })
        .expect(401);
    });

    it('usuario normal → 403 y el reporte no cambia', async () => {
      await http().get('/admin/reportes').set(auth(tok.otro)).expect(403);
      await http()
        .get('/admin/reportes?moderados=true')
        .set(auth(tok.dueno))
        .expect(403);
      await moderar(encontradaId, tok.encontro, {
        moderado: true,
        motivo: 'x',
      }).expect(403);
      // Ni con un body inválido ve algo distinto del 403.
      await moderar(encontradaId, tok.otro, { foo: 1 }).expect(403);

      const r = await prisma.reporte.findUniqueOrThrow({
        where: { id: encontradaId },
      });
      expect(r.moderado).toBe(false);
    });

    it('el login del administrador informa su rol', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ email: EMAILS.admin, password: 'clave-de-prueba-123' })
        .expect(200);
      expect((res.body as { usuario: { rol: string } }).usuario.rol).toBe(
        'ADMIN',
      );
    });
  });

  describe('AC1: ocultar con motivo', () => {
    it('sin motivo → 400; id inexistente → 404', async () => {
      await moderar(encontradaId, tok.admin, { moderado: true }).expect(400);
      await moderar('00000000-0000-0000-0000-000000000000', tok.admin, {
        moderado: true,
        motivo: 'Duplicado',
      }).expect(404);
    });

    it('sale de listados, búsquedas, detalle, contacto y alertas; el dueño lo ve marcado', async () => {
      expect(await alertasDelDueno()).toEqual([encontradaId]);

      const res = await moderar(encontradaId, tok.admin, {
        moderado: true,
        motivo: '  Información duplicada ',
      }).expect(200);
      expect(res.body).toMatchObject({
        id: encontradaId,
        moderado: true,
        motivoModeracion: 'Información duplicada',
        propietarioEmail: EMAILS.encontro,
      });

      // Listado público y búsqueda con filtros.
      expect(await idsListado()).not.toContain(encontradaId);
      expect(await idsListado('?especie=perro&color=negro')).not.toContain(
        encontradaId,
      );
      expect(await idsListado()).toContain(perdidaId);

      // Detalle y contacto: 404 para terceros y anónimos.
      await http().get(`/reportes/${encontradaId}`).expect(404);
      await http()
        .get(`/reportes/${encontradaId}`)
        .set(auth(tok.dueno))
        .expect(404);
      await http()
        .get(`/reportes/${encontradaId}/contacto`)
        .set(auth(tok.dueno))
        .expect(404);

      // Alertas del dueño del reporte perdido.
      expect(await alertasDelDueno()).toEqual([]);
      const mios = await http()
        .get('/usuarios/me/reportes')
        .set(auth(tok.dueno))
        .expect(200);
      expect(
        (mios.body as { id: string; coincidenciasPendientes: number }[]).find(
          (r) => r.id === perdidaId,
        )?.coincidenciasPendientes,
      ).toBe(0);

      // Su dueño sí lo ve, con la marca y el motivo.
      const propio = await http()
        .get(`/reportes/${encontradaId}`)
        .set(auth(tok.encontro))
        .expect(200);
      expect(propio.body).toMatchObject({
        moderado: true,
        motivoModeracion: 'Información duplicada',
        esPropietario: true,
      });
      const misReportes = await http()
        .get('/usuarios/me/reportes')
        .set(auth(tok.encontro))
        .expect(200);
      expect(misReportes.body).toEqual([
        expect.objectContaining({ id: encontradaId, moderado: true }),
      ]);

      // El administrador lo ve en el detalle y en su lista de ocultos.
      await http()
        .get(`/reportes/${encontradaId}`)
        .set(auth(tok.admin))
        .expect(200);
      const ocultos = await http()
        .get('/admin/reportes?moderados=true')
        .set(auth(tok.admin))
        .expect(200);
      expect((ocultos.body as { id: string }[]).map((r) => r.id)).toEqual([
        encontradaId,
      ]);
      const todos = await http()
        .get('/admin/reportes')
        .set(auth(tok.admin))
        .expect(200);
      expect((todos.body as unknown[]).length).toBe(2);
    });

    it('un reporte oculto no genera coincidencias nuevas', async () => {
      await moderar(encontradaId, tok.admin, {
        moderado: true,
        motivo: 'Spam',
      }).expect(200);
      const nueva = await crearReporte(tok.otro, 'PERDIDA');

      expect(
        await prisma.coincidencia.count({ where: { reportePerdidaId: nueva } }),
      ).toBe(0);
    });
  });

  describe('el dueño y su reporte oculto', () => {
    it('puede editarlo (HU17) y sigue oculto; solo el administrador lo restaura', async () => {
      await moderar(encontradaId, tok.admin, {
        moderado: true,
        motivo: 'Datos incorrectos',
      }).expect(200);

      const editado = await http()
        .patch(`/reportes/${encontradaId}`)
        .set(auth(tok.encontro))
        .send({ color: 'café' })
        .expect(200);
      expect(editado.body).toMatchObject({
        color: 'café',
        moderado: true,
        motivoModeracion: 'Datos incorrectos',
      });

      // El dueño no puede quitarse la moderación por ninguna vía.
      await http()
        .patch(`/reportes/${encontradaId}`)
        .set(auth(tok.encontro))
        .send({ moderado: false })
        .expect(400);
      await moderar(encontradaId, tok.encontro, { moderado: false }).expect(
        403,
      );
      expect(await idsListado()).not.toContain(encontradaId);

      await moderar(encontradaId, tok.admin, { moderado: false }).expect(200);
      const r = await prisma.reporte.findUniqueOrThrow({
        where: { id: encontradaId },
      });
      expect(r).toMatchObject({ color: 'café', moderado: false });
      expect(await idsListado()).toContain(encontradaId);
    });
  });

  describe('AC2: restaurar', () => {
    it('vuelve a listados, detalle y alertas; borra el motivo y compara de nuevo', async () => {
      await moderar(encontradaId, tok.admin, {
        moderado: true,
        motivo: 'Spam',
      }).expect(200);
      // Mientras estuvo oculto llegó otro reporte perdido parecido.
      const nueva = await crearReporte(tok.otro, 'PERDIDA');

      const res = await moderar(encontradaId, tok.admin, {
        moderado: false,
      }).expect(200);
      expect(res.body).toMatchObject({
        moderado: false,
        motivoModeracion: null,
      });

      expect(await idsListado()).toContain(encontradaId);
      await http()
        .get(`/reportes/${encontradaId}`)
        .set(auth(tok.dueno))
        .expect(200);
      // La alerta original vuelve sin duplicarse.
      expect(await alertasDelDueno()).toEqual([encontradaId]);
      expect(
        await prisma.coincidencia.count({
          where: { reportePerdidaId: perdidaId },
        }),
      ).toBe(1);
      // La pareja con el reporte creado mientras estaba oculto aparece ahora.
      expect(
        await prisma.coincidencia.count({
          where: { reportePerdidaId: nueva, reporteEncontradaId: encontradaId },
        }),
      ).toBe(1);
    });
  });
});
