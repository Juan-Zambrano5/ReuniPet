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
});
