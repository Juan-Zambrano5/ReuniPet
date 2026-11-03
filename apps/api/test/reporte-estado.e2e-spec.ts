import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { auth, crearUsuarioConSesion } from './helpers/sesion';

const DUENO_EMAIL = 'dueno-estado@test.dev';
const TERCERO_EMAIL = 'tercero-estado@test.dev';

// HU11/HU14: PATCH /reportes/:id/estado (un solo endpoint para ambas HU).
describe('HU11 — PATCH /reportes/:id/estado (marcar como recuperada)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let duenoToken: string;
  let terceroToken: string;

  async function limpiar(): Promise<void> {
    await prisma.coincidencia.deleteMany();
    await prisma.fotografia.deleteMany();
    await prisma.reporte.deleteMany();
    await prisma.usuario.deleteMany({
      where: { email: { in: [DUENO_EMAIL, TERCERO_EMAIL] } },
    });
  }

  // Limpia solo los reportes: conserva a los usuarios de la sesión.
  async function limpiarReportes(): Promise<void> {
    await prisma.coincidencia.deleteMany();
    await prisma.fotografia.deleteMany();
    await prisma.reporte.deleteMany();
  }

  async function crearReporte(
    datos: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const res = await request(app.getHttpServer())
      .post('/reportes')
      .set(auth(duenoToken))
      .send(datos)
      .expect(201);
    return res.body as { id: string };
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

    const dueno = await crearUsuarioConSesion(app, prisma, {
      nombre: 'Dueño Estado',
      email: DUENO_EMAIL,
    });
    duenoToken = dueno.token;

    const tercero = await crearUsuarioConSesion(app, prisma, {
      nombre: 'Tercero Estado',
      email: TERCERO_EMAIL,
    });
    terceroToken = tercero.token;
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  describe('AC1: el propietario cierra su reporte', () => {
    let reporteId: string;

    beforeAll(async () => {
      const reporte = await crearReporte({
        tipo: 'PERDIDA',
        especie: 'Perro',
        raza: 'Labrador',
        color: 'negro',
        caracteristicasDistintivas: 'collar rojo',
      });
      reporteId = reporte.id;
    });

    it('marca el reporte como RECUPERADA y responde 200 con el nuevo estado', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'RECUPERADA' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: reporteId,
        estado: 'RECUPERADA',
        esPropietario: true,
      });
      // El contrato de PATCH no trae fotos (el frontend solo actualiza el estado).
      expect(res.body.fotos).toBeUndefined();
    });

    it('deja de aparecer en el listado público', async () => {
      const res = await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA')
        .expect(200);

      expect(res.body.items.map((i: { id: string }) => i.id)).not.toContain(
        reporteId,
      );
    });

    it('ajuste aprobado: enviar el mismo estado es idempotente (200, sin cambios)', async () => {
      const antes = await prisma.reporte.findUniqueOrThrow({
        where: { id: reporteId },
      });

      const res = await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'RECUPERADA' })
        .expect(200);

      expect(res.body.estado).toBe('RECUPERADA');

      const despues = await prisma.reporte.findUniqueOrThrow({
        where: { id: reporteId },
      });
      expect(despues.updatedAt).toEqual(antes.updatedAt);
    });
  });

  describe('AC3: solo el propietario puede cerrar el reporte', () => {
    it('un tercero recibe 403 y el estado no cambia', async () => {
      const reporte = await crearReporte({
        tipo: 'PERDIDA',
        especie: 'Gato',
        color: 'blanco',
        caracteristicasDistintivas: 'sin marca',
      });

      await request(app.getHttpServer())
        .patch(`/reportes/${reporte.id}/estado`)
        .set(auth(terceroToken))
        .send({ estado: 'RECUPERADA' })
        .expect(403);

      const enDb = await prisma.reporte.findUniqueOrThrow({
        where: { id: reporte.id },
      });
      expect(enDb.estado).toBe('PERDIDA');
    });

    it('reporte inexistente → 404', async () => {
      await request(app.getHttpServer())
        .patch('/reportes/id-que-no-existe/estado')
        .set(auth(duenoToken))
        .send({ estado: 'RECUPERADA' })
        .expect(404);
    });
  });

  describe('AC2: un reporte RECUPERADA no genera ni muestra alertas', () => {
    let perdidaId: string;
    let encontradaId: string;

    beforeAll(async () => {
      await limpiarReportes();
      const perdida = await crearReporte({
        tipo: 'PERDIDA',
        especie: 'Perro',
        raza: 'Beagle',
        color: 'blanco y marrón',
        caracteristicasDistintivas: 'mancha en el ojo',
      });
      perdidaId = perdida.id;
      const encontrada = await crearReporte({
        tipo: 'ENCONTRADA',
        especie: 'Perro',
        raza: 'Beagle',
        color: 'blanco y marrón',
        caracteristicasDistintivas: 'mancha en el ojo',
        ubicacion: 'Parque del Este',
      });
      encontradaId = encontrada.id;
    });

    it('con ambos activos la coincidencia aparece en las alertas del propietario', async () => {
      const res = await request(app.getHttpServer())
        .get('/usuarios/me/alertas')
        .set(auth(duenoToken))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        reportePerdida: { id: perdidaId },
        reporteEncontrada: { id: encontradaId },
      });
    });

    it('al marcar la pérdida como RECUPERADA la alerta desaparece, pero el dato permanece en la BD', async () => {
      await request(app.getHttpServer())
        .patch(`/reportes/${perdidaId}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'RECUPERADA' })
        .expect(200);

      const alertas = await request(app.getHttpServer())
        .get('/usuarios/me/alertas')
        .set(auth(duenoToken))
        .expect(200);
      expect(alertas.body).toEqual([]);

      // Se filtra AL CONSULTAR: la coincidencia sigue intacta (reversible).
      const enDb = await prisma.coincidencia.findFirst({
        where: { reportePerdidaId: perdidaId, reporteEncontradaId: encontradaId },
      });
      expect(enDb).not.toBeNull();
      expect(enDb?.estado).toBe('PENDIENTE');
    });

    it('un reporte nuevo que calza con la RECUPERADA no genera coincidencia con ella', async () => {
      const antes = await prisma.coincidencia.count();

      await crearReporte({
        tipo: 'ENCONTRADA',
        especie: 'Perro',
        raza: 'Beagle',
        color: 'blanco y marrón',
        caracteristicasDistintivas: 'mancha en el ojo',
        ubicacion: 'Plaza Bolívar',
      });

      const despues = await prisma.coincidencia.count();
      expect(despues).toBe(antes);

      const conRecuperada = await prisma.coincidencia.findFirst({
        where: {
          OR: [
            { reportePerdidaId: perdidaId },
            { reporteEncontradaId: perdidaId },
          ],
        },
      });
      // Solo la coincidencia original (con la encontrada previa) puede existir.
      expect(
        conRecuperada === null || conRecuperada.reporteEncontradaId === encontradaId,
      ).toBe(true);
    });
  });

  describe('HU14 — reglas de transición y reapertura', () => {
    it('AC1: cerrar y reabrir un reporte PERDIDA cambia el estado visible en el detalle', async () => {
      await limpiarReportes();
      const reporte = await crearReporte({
        tipo: 'PERDIDA',
        especie: 'Gato',
        color: 'negro',
        caracteristicasDistintivas: 'sin marca',
      });

      const cerrado = await request(app.getHttpServer())
        .patch(`/reportes/${reporte.id}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'RECUPERADA' })
        .expect(200);
      expect(cerrado.body.estado).toBe('RECUPERADA');

      const detalleCerrado = await request(app.getHttpServer())
        .get(`/reportes/${reporte.id}`)
        .set(auth(duenoToken))
        .expect(200);
      expect(detalleCerrado.body.estado).toBe('RECUPERADA');

      const reabierto = await request(app.getHttpServer())
        .patch(`/reportes/${reporte.id}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'PERDIDA' })
        .expect(200);
      expect(reabierto.body.estado).toBe('PERDIDA');

      const detalleAbierto = await request(app.getHttpServer())
        .get(`/reportes/${reporte.id}`)
        .set(auth(duenoToken))
        .expect(200);
      expect(detalleAbierto.body.estado).toBe('PERDIDA');
    });

    it('AC1: un reporte ENCONTRADA también completa el ciclo activo ⇄ RECUPERADA', async () => {
      await limpiarReportes();
      const reporte = await crearReporte({
        tipo: 'ENCONTRADA',
        especie: 'Perro',
        color: 'blanco',
        caracteristicasDistintivas: 'cola corta',
        ubicacion: 'Plaza Mayor',
      });

      await request(app.getHttpServer())
        .patch(`/reportes/${reporte.id}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'RECUPERADA' })
        .expect(200);

      const reabierto = await request(app.getHttpServer())
        .patch(`/reportes/${reporte.id}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'ENCONTRADA' })
        .expect(200);
      expect(reabierto.body.estado).toBe('ENCONTRADA');
    });

    it('AC2: al reabrir, el reporte vuelve al listado y las alertas reaparecen sin tocar la coincidencia', async () => {
      await limpiarReportes();
      const perdida = await crearReporte({
        tipo: 'PERDIDA',
        especie: 'Perro',
        raza: 'Beagle',
        color: 'blanco y marrón',
        caracteristicasDistintivas: 'mancha en el ojo',
      });
      await crearReporte({
        tipo: 'ENCONTRADA',
        especie: 'Perro',
        raza: 'Beagle',
        color: 'blanco y marrón',
        caracteristicasDistintivas: 'mancha en el ojo',
        ubicacion: 'Parque del Este',
      });

      const alertasAntes = await request(app.getHttpServer())
        .get('/usuarios/me/alertas')
        .set(auth(duenoToken))
        .expect(200);
      expect(alertasAntes.body).toHaveLength(1);
      const coincidenciaId = alertasAntes.body[0].coincidenciaId;

      // Cerrar: desaparece del listado y sus alertas se ocultan.
      await request(app.getHttpServer())
        .patch(`/reportes/${perdida.id}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'RECUPERADA' })
        .expect(200);

      const listadoCerrado = await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA')
        .expect(200);
      expect(listadoCerrado.body.items.map((i: { id: string }) => i.id)).not.toContain(
        perdida.id,
      );
      const alertasCerradas = await request(app.getHttpServer())
        .get('/usuarios/me/alertas')
        .set(auth(duenoToken))
        .expect(200);
      expect(alertasCerradas.body).toEqual([]);

      // Reabrir: vuelve al listado y las alertas reaparecen.
      await request(app.getHttpServer())
        .patch(`/reportes/${perdida.id}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'PERDIDA' })
        .expect(200);

      const listadoAbierto = await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA')
        .expect(200);
      expect(listadoAbierto.body.items.map((i: { id: string }) => i.id)).toContain(
        perdida.id,
      );
      const alertasAbiertas = await request(app.getHttpServer())
        .get('/usuarios/me/alertas')
        .set(auth(duenoToken))
        .expect(200);
      expect(alertasAbiertas.body).toHaveLength(1);
      expect(alertasAbiertas.body[0].coincidenciaId).toBe(coincidenciaId);
      expect(alertasAbiertas.body[0].estado).toBe('PENDIENTE');

      // El registro Coincidencia jamás se tocó (filtro al consultar).
      const enDb = await prisma.coincidencia.findUniqueOrThrow({
        where: { id: coincidenciaId },
      });
      expect(enDb.estado).toBe('PENDIENTE');
    });

    it('AC3: estado no correspondiente al tipo → 400 con el estado intacto', async () => {
      await limpiarReportes();
      const activo = await crearReporte({
        tipo: 'PERDIDA',
        especie: 'Gato',
        color: 'gris',
        caracteristicasDistintivas: 'x',
      });

      await request(app.getHttpServer())
        .patch(`/reportes/${activo.id}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'ENCONTRADA' })
        .expect(400);

      const despuesActivo = await prisma.reporte.findUniqueOrThrow({
        where: { id: activo.id },
      });
      expect(despuesActivo.estado).toBe('PERDIDA');

      // También sobre un reporte RECUPERADA: el tipo no cambia nunca.
      await request(app.getHttpServer())
        .patch(`/reportes/${activo.id}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'RECUPERADA' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/reportes/${activo.id}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'ENCONTRADA' })
        .expect(400);

      const despuesRecuperada = await prisma.reporte.findUniqueOrThrow({
        where: { id: activo.id },
      });
      expect(despuesRecuperada.estado).toBe('RECUPERADA');
      expect(despuesRecuperada.tipo).toBe('PERDIDA');
    });

    it('AC3: quien no es propietario recibe 403 al reabrir y el estado queda intacto', async () => {
      await limpiarReportes();
      const reporte = await crearReporte({
        tipo: 'PERDIDA',
        especie: 'Ave',
        color: 'verde',
        caracteristicasDistintivas: 'pico amarillo',
      });
      await request(app.getHttpServer())
        .patch(`/reportes/${reporte.id}/estado`)
        .set(auth(duenoToken))
        .send({ estado: 'RECUPERADA' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/reportes/${reporte.id}/estado`)
        .set(auth(terceroToken))
        .send({ estado: 'PERDIDA' })
        .expect(403);

      const enDb = await prisma.reporte.findUniqueOrThrow({
        where: { id: reporte.id },
      });
      expect(enDb.estado).toBe('RECUPERADA');
    });
  });
});
