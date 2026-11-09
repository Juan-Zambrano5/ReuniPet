import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { auth, crearUsuarioConSesion } from './helpers/sesion';

const DUENO_EMAIL = 'dueno-editar@test.dev';
const TERCERO_EMAIL = 'tercero-editar@test.dev';

const PERRO = {
  especie: 'Perro',
  raza: 'Labrador',
  color: 'negro',
  caracteristicasDistintivas: 'collar rojo',
};

// HU17: PATCH /reportes/:id (editar la información del reporte).
describe('HU17 — PATCH /reportes/:id (editar mi reporte)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let duenoToken: string;
  let terceroToken: string;

  async function limpiarReportes(): Promise<void> {
    await prisma.coincidencia.deleteMany();
    await prisma.fotografia.deleteMany();
    await prisma.reporte.deleteMany();
  }

  async function crearReporte(
    token: string,
    datos: Record<string, unknown>,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/reportes')
      .set(auth(token))
      .send(datos)
      .expect(201);
    return (res.body as { id: string }).id;
  }

  function editar(id: string, token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .patch(`/reportes/${id}`)
      .set(auth(token))
      .send(body);
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

    await limpiarReportes();
    await prisma.usuario.deleteMany({
      where: { email: { in: [DUENO_EMAIL, TERCERO_EMAIL] } },
    });
    duenoToken = (
      await crearUsuarioConSesion(app, prisma, {
        nombre: 'Dueño Editar',
        email: DUENO_EMAIL,
      })
    ).token;
    terceroToken = (
      await crearUsuarioConSesion(app, prisma, {
        nombre: 'Tercero Editar',
        email: TERCERO_EMAIL,
      })
    ).token;
  });

  afterAll(async () => {
    await limpiarReportes();
    await prisma.usuario.deleteMany({
      where: { email: { in: [DUENO_EMAIL, TERCERO_EMAIL] } },
    });
    await app.close();
  });

  describe('AC1: el cambio se refleja en el detalle y en el listado', () => {
    let id: string;

    beforeAll(async () => {
      await limpiarReportes();
      id = await crearReporte(duenoToken, { tipo: 'PERDIDA', ...PERRO });
    });

    it('responde el reporte actualizado, sin propietarioId', async () => {
      const res = await editar(id, duenoToken, {
        raza: 'Mestizo',
        color: 'café',
        caracteristicasDistintivas: 'mancha blanca en el pecho',
      }).expect(200);

      expect(res.body).toMatchObject({
        id,
        tipo: 'PERDIDA',
        estado: 'PERDIDA',
        especie: 'Perro',
        raza: 'Mestizo',
        color: 'café',
        caracteristicasDistintivas: 'mancha blanca en el pecho',
        esPropietario: true,
      });
      expect(res.body).not.toHaveProperty('propietarioId');
    });

    it('el detalle (incluso anónimo) muestra los datos nuevos', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reportes/${id}`)
        .expect(200);
      expect(res.body).toMatchObject({
        raza: 'Mestizo',
        color: 'café',
        caracteristicasDistintivas: 'mancha blanca en el pecho',
      });
    });

    it('el listado muestra los datos nuevos', async () => {
      const res = await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA&limit=50')
        .expect(200);
      const item = (res.body.items as Array<{ id: string }>).find(
        (i) => i.id === id,
      );
      expect(item).toMatchObject({ raza: 'Mestizo', color: 'café' });
    });

    it('raza vacía la borra (null)', async () => {
      const res = await editar(id, duenoToken, { raza: '' }).expect(200);
      expect(res.body.raza).toBeNull();
    });
  });

  describe('AC2: recalcula las PENDIENTE y conserva VISTA y DESCARTADA', () => {
    let perdidaId: string;
    let pendienteE: string;
    let vistaE: string;
    let descartadaE: string;
    let gatoE: string;

    async function coincidenciaCon(encontradaId: string) {
      return prisma.coincidencia.findFirst({
        where: { reportePerdidaId: perdidaId, reporteEncontradaId: encontradaId },
      });
    }

    beforeAll(async () => {
      await limpiarReportes();
      perdidaId = await crearReporte(duenoToken, { tipo: 'PERDIDA', ...PERRO });
      const hallazgo = { tipo: 'ENCONTRADA', ubicacion: 'Parque' };
      pendienteE = await crearReporte(terceroToken, { ...hallazgo, ...PERRO });
      vistaE = await crearReporte(terceroToken, { ...hallazgo, ...PERRO });
      descartadaE = await crearReporte(terceroToken, { ...hallazgo, ...PERRO });
      gatoE = await crearReporte(terceroToken, {
        ...hallazgo,
        especie: 'Gato',
        raza: 'Siamés',
        color: 'blanco',
        caracteristicasDistintivas: 'ojos azules',
      });

      await prisma.coincidencia.updateMany({
        where: { reportePerdidaId: perdidaId, reporteEncontradaId: vistaE },
        data: { estado: 'VISTA' },
      });
      await prisma.coincidencia.updateMany({
        where: { reportePerdidaId: perdidaId, reporteEncontradaId: descartadaE },
        data: { estado: 'DESCARTADA' },
      });
    });

    it('cambiar solo las características no toca las coincidencias', async () => {
      const antes = await coincidenciaCon(pendienteE);
      expect(antes?.estado).toBe('PENDIENTE');

      await editar(perdidaId, duenoToken, {
        caracteristicasDistintivas: 'collar azul',
      }).expect(200);

      const despues = await coincidenciaCon(pendienteE);
      expect(despues?.id).toBe(antes?.id);
      expect(await coincidenciaCon(gatoE)).toBeNull();
    });

    it('cambiar especie, raza y color borra la PENDIENTE y genera las nuevas', async () => {
      const vista = await coincidenciaCon(vistaE);
      const descartada = await coincidenciaCon(descartadaE);

      await editar(perdidaId, duenoToken, {
        especie: 'Gato',
        raza: 'siames',
        color: 'Blanco',
      }).expect(200);

      // La PENDIENTE con el perro ya no aplica.
      expect(await coincidenciaCon(pendienteE)).toBeNull();
      // VISTA y DESCARTADA se conservan, con su id y su estado.
      expect(await coincidenciaCon(vistaE)).toMatchObject({
        id: vista?.id,
        estado: 'VISTA',
      });
      expect(await coincidenciaCon(descartadaE)).toMatchObject({
        id: descartada?.id,
        estado: 'DESCARTADA',
      });
      // La nueva comparación encuentra al gato.
      expect(await coincidenciaCon(gatoE)).toMatchObject({ estado: 'PENDIENTE' });
    });
  });

  describe('reabrir un reporte recuperado vuelve a comparar', () => {
    let perdidaId: string;
    let perroE: string;
    let vistaE: string;
    let gatoE: string;

    function estado(estadoNuevo: string) {
      return request(app.getHttpServer())
        .patch(`/reportes/${perdidaId}/estado`)
        .set(auth(duenoToken))
        .send({ estado: estadoNuevo })
        .expect(200);
    }

    async function coincidencias() {
      return prisma.coincidencia.findMany({
        where: { reportePerdidaId: perdidaId },
        select: { id: true, reporteEncontradaId: true, estado: true },
        orderBy: { id: 'asc' },
      });
    }

    async function alertas(): Promise<Array<{ coincidenciaId: string; estado: string }>> {
      const res = await request(app.getHttpServer())
        .get('/usuarios/me/alertas')
        .set(auth(duenoToken))
        .expect(200);
      return res.body as Array<{ coincidenciaId: string; estado: string }>;
    }

    beforeAll(async () => {
      await limpiarReportes();
      perdidaId = await crearReporte(duenoToken, { tipo: 'PERDIDA', ...PERRO });
      const hallazgo = { tipo: 'ENCONTRADA', ubicacion: 'Parque' };
      perroE = await crearReporte(terceroToken, { ...hallazgo, ...PERRO });
      vistaE = await crearReporte(terceroToken, { ...hallazgo, ...PERRO });
      gatoE = await crearReporte(terceroToken, {
        ...hallazgo,
        especie: 'Gato',
        raza: 'Siamés',
        color: 'blanco',
        caracteristicasDistintivas: 'ojos azules',
      });
      await prisma.coincidencia.updateMany({
        where: { reportePerdidaId: perdidaId, reporteEncontradaId: vistaE },
        data: { estado: 'VISTA' },
      });
    });

    it('cerrar y reabrir sin editar deja las mismas coincidencias', async () => {
      const antes = await coincidencias();
      expect(antes).toHaveLength(2);

      await estado('RECUPERADA');
      expect(await alertas()).toHaveLength(0);
      await estado('PERDIDA');

      expect(await coincidencias()).toEqual(antes);
    });

    it('editar estando recuperado y reabrir: las PENDIENTE nuevas aparecen y la VISTA sigue VISTA', async () => {
      const vista = (await coincidencias()).find(
        (c) => c.reporteEncontradaId === vistaE,
      );

      await estado('RECUPERADA');
      await editar(perdidaId, duenoToken, {
        especie: 'Gato',
        raza: 'siames',
        color: 'Blanco',
      }).expect(200);
      // Recuperado: se borró la PENDIENTE del perro y todavía no se compara.
      const cerrado = await coincidencias();
      expect(cerrado.map((c) => c.reporteEncontradaId)).toEqual([vistaE]);

      await estado('PERDIDA');

      const despues = await coincidencias();
      expect(despues.find((c) => c.reporteEncontradaId === gatoE)?.estado).toBe(
        'PENDIENTE',
      );
      expect(despues.find((c) => c.reporteEncontradaId === perroE)).toBeUndefined();
      expect(despues.find((c) => c.reporteEncontradaId === vistaE)).toEqual(vista);

      const visibles = await alertas();
      const gato = despues.find((c) => c.reporteEncontradaId === gatoE);
      expect(visibles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ coincidenciaId: gato?.id, estado: 'PENDIENTE' }),
          expect.objectContaining({ coincidenciaId: vista?.id, estado: 'VISTA' }),
        ]),
      );
    });
  });

  describe('AC3: solo el propietario; tipo y estado no se editan', () => {
    let id: string;

    beforeAll(async () => {
      await limpiarReportes();
      id = await crearReporte(duenoToken, { tipo: 'PERDIDA', ...PERRO });
    });

    async function sinCambios(): Promise<void> {
      const guardado = await prisma.reporte.findUniqueOrThrow({ where: { id } });
      expect(guardado).toMatchObject({
        tipo: 'PERDIDA',
        estado: 'PERDIDA',
        ...PERRO,
      });
    }

    it('un tercero recibe 403 y el reporte no cambia', async () => {
      await editar(id, terceroToken, { especie: 'Gato' }).expect(403);
      await sinCambios();
    });

    it('enviar tipo o estado → 400 y nada cambia (ni los demás campos)', async () => {
      await editar(id, duenoToken, { tipo: 'ENCONTRADA' }).expect(400);
      await editar(id, duenoToken, { estado: 'RECUPERADA' }).expect(400);
      await editar(id, duenoToken, { color: 'gris', tipo: 'ENCONTRADA' }).expect(
        400,
      );
      await editar(id, duenoToken, { fotos: [], propietarioId: 'x' }).expect(400);
      await sinCambios();
    });

    it('sin sesión → 401; reporte inexistente → 404; body vacío → 400', async () => {
      await request(app.getHttpServer())
        .patch(`/reportes/${id}`)
        .send({ especie: 'Gato' })
        .expect(401);
      await editar('no-existe', duenoToken, { especie: 'Gato' }).expect(404);
      await editar(id, duenoToken, {}).expect(400);
      await sinCambios();
    });
  });
});
