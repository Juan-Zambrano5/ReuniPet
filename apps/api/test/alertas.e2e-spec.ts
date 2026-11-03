import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('HU4 — Alertas de coincidencia', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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

    await prisma.coincidencia.deleteMany();
    await prisma.reporte.deleteMany();
  });

  afterAll(async () => {
    await prisma.coincidencia.deleteMany();
    await prisma.fotografia.deleteMany();
    await prisma.reporte.deleteMany();
    await app.close();
  });

  async function crearParCoincidente(): Promise<void> {
    await request(app.getHttpServer())
      .post('/reportes')
      .send({
        tipo: 'PERDIDA',
        especie: 'Perro',
        raza: 'Labrador',
        color: 'Negro',
        caracteristicasDistintivas: 'collar rojo',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/reportes')
      .send({
        tipo: 'ENCONTRADA',
        especie: 'perro',
        raza: 'labrador',
        color: 'negro',
        caracteristicasDistintivas: 'similar',
        ubicacion: 'Parque Central',
      })
      .expect(201);
  }

  it('AC1+AC2: el propietario recibe la alerta con score y datos de ambos reportes', async () => {
    await crearParCoincidente();

    const res = await request(app.getHttpServer())
      .get('/usuarios/me/alertas')
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const alerta = res.body[0];
    expect(alerta).toMatchObject({
      score: 1,
      estado: 'PENDIENTE',
      reportePerdida: expect.objectContaining({ especie: 'Perro' }),
      reporteEncontrada: expect.objectContaining({
        ubicacion: 'Parque Central',
      }),
    });
    expect(alerta.coincidenciaId).toBeDefined();
    expect(alerta.reportePerdida.id).toBeDefined();
    expect(alerta.reporteEncontrada.id).toBeDefined();
  });

  it('AC3: PATCH /alertas/:id/visto marca la alerta como VISTA', async () => {
    const list = await request(app.getHttpServer())
      .get('/usuarios/me/alertas')
      .expect(200);
    const id = list.body[0].coincidenciaId;

    const res = await request(app.getHttpServer())
      .patch(`/alertas/${id}/visto`)
      .expect(200);
    expect(res.body.estado).toBe('VISTA');

    // sigue listada (PENDIENTE y VISTA se devuelven)
    const despues = await request(app.getHttpServer())
      .get('/usuarios/me/alertas')
      .expect(200);
    expect(
      despues.body.some(
        (a: { coincidenciaId: string; estado: string }) =>
          a.coincidenciaId === id && a.estado === 'VISTA',
      ),
    ).toBe(true);
  });

  it('un usuario distinto NO ve las alertas de otro propietario', async () => {
    const otro = await prisma.usuario.create({
      data: { nombre: 'Otro', email: `otro-${Date.now()}@test.com` },
    });

    const res = await request(app.getHttpServer())
      .get('/usuarios/me/alertas')
      .set('X-User-Id', otro.id)
      .expect(200);

    expect(res.body).toHaveLength(0);
  });

  it('devuelve 404 al marcar una alerta inexistente', async () => {
    await request(app.getHttpServer())
      .patch('/alertas/no-existe/visto')
      .expect(404);
  });

  it('PATCH /alertas/:id/descartar elimina la alerta de la lista y no vuelve a aparecer', async () => {
    const list = await request(app.getHttpServer())
      .get('/usuarios/me/alertas')
      .expect(200);
    expect(list.body.length).toBeGreaterThan(0);
    const id = list.body[0].coincidenciaId;

    const res = await request(app.getHttpServer())
      .patch(`/alertas/${id}/descartar`)
      .expect(200);
    expect(res.body.estado).toBe('DESCARTADA');

    const trasDescartar = await request(app.getHttpServer())
      .get('/usuarios/me/alertas')
      .expect(200);
    expect(
      trasDescartar.body.some(
        (a: { coincidenciaId: string }) => a.coincidenciaId === id,
      ),
    ).toBe(false);

    // reintentar descartar la misma sigue siendo 200 y sigue fuera de la lista
    await request(app.getHttpServer())
      .patch(`/alertas/${id}/descartar`)
      .expect(200);
    const alRecargar = await request(app.getHttpServer())
      .get('/usuarios/me/alertas')
      .expect(200);
    expect(
      alRecargar.body.some(
        (a: { coincidenciaId: string }) => a.coincidenciaId === id,
      ),
    ).toBe(false);
  });

  it('devuelve 404 al descartar una alerta inexistente', async () => {
    await request(app.getHttpServer())
      .patch('/alertas/no-existe/descartar')
      .expect(404);
  });

  describe('seguridad: solo el dueño del reporte perdido gestiona su alerta', () => {
    async function nuevaAlertaPendiente(): Promise<string> {
      await prisma.coincidencia.deleteMany();
      await crearParCoincidente();
      const list = await request(app.getHttpServer())
        .get('/usuarios/me/alertas')
        .expect(200);
      const alerta = (
        list.body as { coincidenciaId: string; estado: string }[]
      ).find((a) => a.estado === 'PENDIENTE');
      if (!alerta) throw new Error('no se generó la alerta');
      return alerta.coincidenciaId;
    }

    async function intruso(): Promise<string> {
      const u = await prisma.usuario.create({
        data: { nombre: 'Intruso', email: `intruso-${Date.now()}@test.com` },
      });
      return u.id;
    }

    it('otro usuario recibe 403 al marcarla como vista y el estado no cambia', async () => {
      const id = await nuevaAlertaPendiente();
      await request(app.getHttpServer())
        .patch(`/alertas/${id}/visto`)
        .set('X-User-Id', await intruso())
        .expect(403);
      const c = await prisma.coincidencia.findUniqueOrThrow({ where: { id } });
      expect(c.estado).toBe('PENDIENTE');
    });

    it('otro usuario recibe 403 al descartarla y el estado no cambia', async () => {
      const id = await nuevaAlertaPendiente();
      await request(app.getHttpServer())
        .patch(`/alertas/${id}/descartar`)
        .set('X-User-Id', await intruso())
        .expect(403);
      const c = await prisma.coincidencia.findUniqueOrThrow({ where: { id } });
      expect(c.estado).toBe('PENDIENTE');
    });

    it('AC3: abrir dos veces es idempotente y no revive una descartada', async () => {
      const id = await nuevaAlertaPendiente();
      await request(app.getHttpServer()).patch(`/alertas/${id}/visto`).expect(200);
      const antes = await prisma.coincidencia.findUniqueOrThrow({ where: { id } });
      const otra = await request(app.getHttpServer())
        .patch(`/alertas/${id}/visto`)
        .expect(200);
      expect((otra.body as { estado: string }).estado).toBe('VISTA');
      const despues = await prisma.coincidencia.findUniqueOrThrow({ where: { id } });
      expect(despues).toEqual(antes);

      await request(app.getHttpServer())
        .patch(`/alertas/${id}/descartar`)
        .expect(200);
      const reabierta = await request(app.getHttpServer())
        .patch(`/alertas/${id}/visto`)
        .expect(200);
      expect((reabierta.body as { estado: string }).estado).toBe('DESCARTADA');
    });

    it('el dueño sí puede marcarla como vista y descartarla', async () => {
      const id = await nuevaAlertaPendiente();
      const visto = await request(app.getHttpServer())
        .patch(`/alertas/${id}/visto`)
        .expect(200);
      expect((visto.body as { estado: string }).estado).toBe('VISTA');
      const desc = await request(app.getHttpServer())
        .patch(`/alertas/${id}/descartar`)
        .expect(200);
      expect((desc.body as { estado: string }).estado).toBe('DESCARTADA');
    });
  });
});
