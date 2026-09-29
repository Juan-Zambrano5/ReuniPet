import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DEMO_EMAIL } from '../src/usuarios/current-user.provider';

const TERCERO_EMAIL = 'tercero-ubicacion@test.dev';

describe('HU9 — ubicación de reportes (coords + aproximación)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let demoId: string;
  let terceroId: string;

  async function limpiar(): Promise<void> {
    await prisma.coincidencia.deleteMany();
    await prisma.fotografia.deleteMany();
    await prisma.reporte.deleteMany();
    await prisma.usuario.deleteMany({ where: { email: TERCERO_EMAIL } });
  }

  async function crearTercero(): Promise<void> {
    const tercero = await prisma.usuario.create({
      data: {
        nombre: 'Tercero Ubicación',
        email: TERCERO_EMAIL,
        telefono: '04120000002',
      },
    });
    terceroId = tercero.id;
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

    const demo = await prisma.usuario.findUniqueOrThrow({
      where: { email: DEMO_EMAIL },
    });
    demoId = demo.id;
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  describe('AC2: crear un reporte con coordenadas', () => {
    beforeAll(async () => {
      await limpiar();
    });

    it('POST con latitud/longitud las guarda en la BD y las devuelve al dueño', async () => {
      const res = await request(app.getHttpServer())
        .post('/reportes')
        .send({
          tipo: 'PERDIDA',
          especie: 'Perro',
          color: 'negro',
          caracteristicasDistintivas: 'collar rojo',
          ubicacion: 'Parque Central',
          latitud: 10.12345,
          longitud: -66.98765,
        })
        .expect(201);

      const guardado = await prisma.reporte.findUnique({
        where: { id: res.body.id },
        select: { latitud: true, longitud: true, ubicacion: true },
      });
      expect(guardado?.latitud).toBeCloseTo(10.12345);
      expect(guardado?.longitud).toBeCloseTo(-66.98765);
      expect(guardado?.ubicacion).toBe('Parque Central');

      // Creador = propietario: coordenadas exactas.
      expect(res.body).toMatchObject({
        latitud: 10.12345,
        longitud: -66.98765,
        esPropietario: true,
      });
    });

    it('POST con solo latitud (par incompleto) → 400', async () => {
      await request(app.getHttpServer())
        .post('/reportes')
        .send({
          tipo: 'PERDIDA',
          especie: 'Gato',
          color: 'blanco',
          caracteristicasDistintivas: 'sin cola',
          latitud: 10.1,
        })
        .expect(400);
    });

    it('POST con coordenadas fuera de rango → 400', async () => {
      await request(app.getHttpServer())
        .post('/reportes')
        .send({
          tipo: 'PERDIDA',
          especie: 'Gato',
          color: 'blanco',
          caracteristicasDistintivas: 'sin cola',
          latitud: 100,
          longitud: -66,
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/reportes')
        .send({
          tipo: 'PERDIDA',
          especie: 'Gato',
          color: 'blanco',
          caracteristicasDistintivas: 'sin cola',
          latitud: 10,
          longitud: -200,
        })
        .expect(400);
    });

    it('HU9 AC1: ENCONTRADA con punto en el mapa y sin dirección escrita → 201', async () => {
      await request(app.getHttpServer())
        .post('/reportes')
        .send({
          tipo: 'ENCONTRADA',
          especie: 'Gato',
          color: 'blanco',
          caracteristicasDistintivas: 'oreja cortada',
          latitud: 10.4,
          longitud: -66.85,
        })
        .expect(201);
    });

    it('HU3 intacto: ENCONTRADA sin dirección y sin punto sigue rechazándose', async () => {
      await request(app.getHttpServer())
        .post('/reportes')
        .send({
          tipo: 'ENCONTRADA',
          especie: 'Gato',
          color: 'blanco',
          caracteristicasDistintivas: 'oreja cortada',
        })
        .expect(400);
    });
  });

  describe('AC3: coordenadas exactas al dueño, aproximadas a terceros', () => {
    let reporteConCoordsId: string;
    let reporteSinCoordsId: string;

    beforeAll(async () => {
      await limpiar();
      await crearTercero();

      // Creado por el usuario demo (sin header → sesión demo).
      const conCoords = await prisma.reporte.create({
        data: {
          tipo: 'PERDIDA',
          especie: 'Perro',
          color: 'negro',
          caracteristicasDistintivas: 'collar rojo',
          ubicacion: 'Parque Central',
          latitud: 10.12345,
          longitud: -66.98765,
          estado: 'PERDIDA',
          propietarioId: demoId,
        },
      });
      reporteConCoordsId = conCoords.id;

      const sinCoords = await prisma.reporte.create({
        data: {
          tipo: 'PERDIDA',
          especie: 'Gato',
          color: 'blanco',
          caracteristicasDistintivas: 'oreja cortada',
          estado: 'PERDIDA',
          propietarioId: demoId,
        },
      });
      reporteSinCoordsId = sinCoords.id;
    });

    it('el propietario ve las coordenadas exactas en el detalle', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reportes/${reporteConCoordsId}`)
        .expect(200);

      expect(res.body).toMatchObject({
        latitud: 10.12345,
        longitud: -66.98765,
        esPropietario: true,
      });
    });

    it('un tercero ve las coordenadas aproximadas (~1km), nunca el punto exacto', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reportes/${reporteConCoordsId}`)
        .set('X-User-Id', terceroId)
        .expect(200);

      expect(res.body.latitud).toBe(10.12);
      expect(res.body.longitud).toBe(-66.99);
      expect(res.body.latitud).not.toBe(10.12345);
      expect(res.body.esPropietario).toBe(false);
    });

    it('un reporte sin coordenadas las devuelve null para todos', async () => {
      const tercero = await request(app.getHttpServer())
        .get(`/reportes/${reporteSinCoordsId}`)
        .set('X-User-Id', terceroId)
        .expect(200);
      expect(tercero.body.latitud).toBeNull();
      expect(tercero.body.longitud).toBeNull();

      const dueno = await request(app.getHttpServer())
        .get(`/reportes/${reporteSinCoordsId}`)
        .expect(200);
      expect(dueno.body.latitud).toBeNull();
    });

    it('detalle de un reporte inexistente → 404', async () => {
      await request(app.getHttpServer())
        .get('/reportes/no-existe-123')
        .expect(404);
    });
  });

  describe('PATCH /reportes/:id/ubicacion', () => {
    let reporteId: string;

    beforeAll(async () => {
      await limpiar();
      await crearTercero();

      const creado = await prisma.reporte.create({
        data: {
          tipo: 'PERDIDA',
          especie: 'Perro',
          raza: 'labrador',
          color: 'marrón',
          caracteristicasDistintivas: 'collar rojo',
          ubicacion: 'Parque Central',
          latitud: 10.12345,
          longitud: -66.98765,
          estado: 'PERDIDA',
          propietarioId: demoId,
        },
      });
      reporteId = creado.id;
    });

    it('AC2: el propietario actualiza el punto y el texto de referencia', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}/ubicacion`)
        .send({
          latitud: 11.12345,
          longitud: -67.23456,
          ubicacion: 'Av. Libertador con Calle 5',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        id: reporteId,
        latitud: 11.12345,
        longitud: -67.23456,
        ubicacion: 'Av. Libertador con Calle 5',
        esPropietario: true,
      });

      const guardado = await prisma.reporte.findUnique({
        where: { id: reporteId },
        select: { latitud: true, longitud: true, ubicacion: true },
      });
      expect(guardado?.latitud).toBeCloseTo(11.12345);
      expect(guardado?.longitud).toBeCloseTo(-67.23456);
      expect(guardado?.ubicacion).toBe('Av. Libertador con Calle 5');
    });

    it('AC3: tras el PATCH, un tercero ve el nuevo punto aproximado', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reportes/${reporteId}`)
        .set('X-User-Id', terceroId)
        .expect(200);

      expect(res.body.latitud).toBe(11.12);
      expect(res.body.longitud).toBe(-67.23);
      expect(res.body.ubicacion).toBe('Av. Libertador con Calle 5');
    });

    it('si no se envía texto, el de referencia queda intacto', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}/ubicacion`)
        .send({ latitud: 11.5, longitud: -67.5 })
        .expect(200);

      expect(res.body.ubicacion).toBe('Av. Libertador con Calle 5');
      expect(res.body.latitud).toBe(11.5);
    });

    it('un tercero no puede actualizar el reporte de otro usuario → 403', async () => {
      await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}/ubicacion`)
        .set('X-User-Id', terceroId)
        .send({ latitud: 10, longitud: -66 })
        .expect(403);

      // El punto no cambió.
      const guardado = await prisma.reporte.findUnique({
        where: { id: reporteId },
        select: { latitud: true },
      });
      expect(guardado?.latitud).toBeCloseTo(11.5);
    });

    it('reporte inexistente → 404', async () => {
      await request(app.getHttpServer())
        .patch('/reportes/no-existe-123/ubicacion')
        .send({ latitud: 10, longitud: -66 })
        .expect(404);
    });

    it('valida coordenadas: faltantes, fuera de rango y campos desconocidos → 400', async () => {
      await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}/ubicacion`)
        .send({ latitud: 10 })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}/ubicacion`)
        .send({ latitud: 100, longitud: -66 })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}/ubicacion`)
        .send({ latitud: 10, longitud: -200 })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}/ubicacion`)
        .send({ latitud: 10, longitud: -66, foo: 'bar' })
        .expect(400);
    });
  });
});
