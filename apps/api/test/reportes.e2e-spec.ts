import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('HU1 — POST /reportes (mascota perdida)', () => {
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
  });

  afterAll(async () => {
    await prisma.coincidencia.deleteMany();
    await prisma.fotografia.deleteMany();
    await prisma.reporte.deleteMany();
    await app.close();
  });

  it('AC: crea un reporte tipo PERDIDA con estado PERDIDA y lo asocia al usuario en sesión', async () => {
    const res = await request(app.getHttpServer())
      .post('/reportes')
      .set('X-User-Id', '') // sin header → usuario demo del seed
      .send({
        tipo: 'PERDIDA',
        especie: 'Gato',
        raza: 'siames',
        color: 'blanco',
        caracteristicasDistintivas: 'oreja izquierda cortada',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      tipo: 'PERDIDA',
      estado: 'PERDIDA',
      especie: 'Gato',
      color: 'blanco',
      caracteristicasDistintivas: 'oreja izquierda cortada',
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.propietarioId).toBeDefined();

    const saved = await prisma.reporte.findUnique({
      where: { id: res.body.id },
    });
    expect(saved).not.toBeNull();
    expect(saved?.estado).toBe('PERDIDA');
  });

  it('AC: devuelve 400 con mensaje de error cuando falta un campo obligatorio (color)', async () => {
    const res = await request(app.getHttpServer())
      .post('/reportes')
      .send({
        tipo: 'PERDIDA',
        especie: 'Perro',
        caracteristicasDistintivas: 'collar azul',
      })
      .expect(400);

    const messages = JSON.stringify(res.body);
    expect(messages).toContain('color');
  });

  it('AC: devuelve 400 cuando la especie está vacía', async () => {
    await request(app.getHttpServer())
      .post('/reportes')
      .send({
        tipo: 'PERDIDA',
        especie: '',
        color: 'marrón',
        caracteristicasDistintivas: 'sin cola',
      })
      .expect(400);
  });

  it('HU3 AC1/AC2: crea un reporte ENCONTRADA con ubicación y estado ENCONTRADA', async () => {
    const res = await request(app.getHttpServer())
      .post('/reportes')
      .send({
        tipo: 'ENCONTRADA',
        especie: 'Perro',
        raza: 'beagle',
        color: 'blanco y marrón',
        caracteristicasDistintivas: 'pata delantera cojeando',
        ubicacion: 'Av. Principal y Calle 5, cerca del parque',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      tipo: 'ENCONTRADA',
      estado: 'ENCONTRADA',
      ubicacion: 'Av. Principal y Calle 5, cerca del parque',
    });

    // AC3: cualquier usuario puede consultar el reporte (sin header de sesión)
    const detalle = await request(app.getHttpServer())
      .get(`/reportes/${res.body.id}`)
      .expect(200);
    expect(detalle.body).toMatchObject({
      especie: 'Perro',
      color: 'blanco y marrón',
      caracteristicasDistintivas: 'pata delantera cojeando',
      ubicacion: 'Av. Principal y Calle 5, cerca del parque',
    });
  });

  it('HU3 AC2: rechaza un reporte ENCONTRADA sin ubicación', async () => {
    const res = await request(app.getHttpServer())
      .post('/reportes')
      .send({
        tipo: 'ENCONTRADA',
        especie: 'Gato',
        color: 'negro',
        caracteristicasDistintivas: 'oreja rota',
      })
      .expect(400);

    expect(JSON.stringify(res.body).toLowerCase()).toContain('ubicaci');
  });
});
