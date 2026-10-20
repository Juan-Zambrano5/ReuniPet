import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DUENO_EMAIL = 'dueno-detalle@test.dev';
const DUENO_TEL = '04129998877';
const TERCERO_EMAIL = 'tercero-detalle@test.dev';

// HU13: GET /reportes/:id con todas sus fotografías y reglas de privacidad.
describe('HU13 — GET /reportes/:id (detalle y fotografías)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let duenoId: string;
  let terceroId: string;
  let reporteConFotosId: string;
  let reporteSinFotosId: string;

  // Latitud elegida para que el redondeo a ~1km (2 decimales) sea observable.
  const LAT_EXACTA = 10.5555;
  const LNG_EXACTA = -66.6666;
  const LAT_APROX = 10.56;
  const LNG_APROX = -66.67;

  async function limpiar(): Promise<void> {
    await prisma.coincidencia.deleteMany();
    await prisma.fotografia.deleteMany();
    await prisma.reporte.deleteMany();
    await prisma.usuario.deleteMany({
      where: { email: { in: [DUENO_EMAIL, TERCERO_EMAIL] } },
    });
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

    const dueno = await prisma.usuario.create({
      data: {
        nombre: 'Dueño Detalle',
        email: DUENO_EMAIL,
        telefono: DUENO_TEL,
      },
    });
    duenoId = dueno.id;

    const tercero = await prisma.usuario.create({
      data: { nombre: 'Tercero Detalle', email: TERCERO_EMAIL },
    });
    terceroId = tercero.id;

    const conFotos = await prisma.reporte.create({
      data: {
        tipo: 'PERDIDA',
        especie: 'Perro',
        raza: 'Labrador',
        color: 'negro',
        caracteristicasDistintivas: 'collar rojo',
        ubicacion: 'Parque Central',
        latitud: LAT_EXACTA,
        longitud: LNG_EXACTA,
        estado: 'PERDIDA',
        propietarioId: duenoId,
        createdAt: new Date('2026-09-28T10:00:00.000Z'),
      },
    });
    reporteConFotosId = conFotos.id;

    // Se insertan deliberadamente fuera de orden: el detalle debe servirlas
    // ordenadas por "orden" ascendente.
    await prisma.fotografia.createMany({
      data: [
        { reporteId: conFotos.id, url: '/files/foto-2.jpg', orden: 2 },
        { reporteId: conFotos.id, url: '/files/foto-0.jpg', orden: 0 },
        { reporteId: conFotos.id, url: '/files/foto-1.jpg', orden: 1 },
      ],
    });

    const sinFotos = await prisma.reporte.create({
      data: {
        tipo: 'ENCONTRADA',
        especie: 'Gato',
        color: 'naranja',
        caracteristicasDistintivas: 'sin marca',
        ubicacion: 'Av. 5',
        estado: 'ENCONTRADA',
        propietarioId: duenoId,
      },
    });
    reporteSinFotosId = sinFotos.id;
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  describe('AC1: todos los datos y TODAS las fotografías, ordenadas', () => {
    it('devuelve las 3 fotos ordenadas por "orden" ascendente', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reportes/${reporteConFotosId}`)
        .set('X-User-Id', terceroId)
        .expect(200);

      expect(res.body.fotos).toHaveLength(3);
      expect(
        res.body.fotos.map((f: { orden: number }) => f.orden),
      ).toEqual([0, 1, 2]);
      expect(
        res.body.fotos.map((f: { url: string }) => f.url),
      ).toEqual(['/files/foto-0.jpg', '/files/foto-1.jpg', '/files/foto-2.jpg']);
    });

    it('devuelve tipo, especie, raza, color, características, ubicación, estado y fechas', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reportes/${reporteConFotosId}`)
        .set('X-User-Id', terceroId)
        .expect(200);

      expect(res.body).toMatchObject({
        id: reporteConFotosId,
        tipo: 'PERDIDA',
        especie: 'Perro',
        raza: 'Labrador',
        color: 'negro',
        caracteristicasDistintivas: 'collar rojo',
        ubicacion: 'Parque Central',
        estado: 'PERDIDA',
        createdAt: '2026-09-28T10:00:00.000Z',
      });
      expect(res.body.updatedAt).toBeDefined();
    });

    it('marca esPropietario: false al tercero y true al dueño (con coords exactas)', async () => {
      const comoTercero = await request(app.getHttpServer())
        .get(`/reportes/${reporteConFotosId}`)
        .set('X-User-Id', terceroId)
        .expect(200);
      expect(comoTercero.body.esPropietario).toBe(false);

      const comoDueno = await request(app.getHttpServer())
        .get(`/reportes/${reporteConFotosId}`)
        .set('X-User-Id', duenoId)
        .expect(200);
      expect(comoDueno.body.esPropietario).toBe(true);
      expect(comoDueno.body.latitud).toBe(LAT_EXACTA);
      expect(comoDueno.body.longitud).toBe(LNG_EXACTA);
    });
  });

  describe('AC2: reporte sin fotografías', () => {
    it('devuelve fotos: [] (arreglo vacío, no null ni undefined)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reportes/${reporteSinFotosId}`)
        .set('X-User-Id', terceroId)
        .expect(200);

      expect(res.body.fotos).toEqual([]);
      expect(res.body).toMatchObject({ especie: 'Gato', estado: 'ENCONTRADA' });
    });
  });

  describe('AC3: reporte inexistente', () => {
    it('responde 404 con mensaje de no encontrado', async () => {
      const res = await request(app.getHttpServer())
        .get('/reportes/id-que-no-existe')
        .expect(404);

      expect(String(res.body.message).toLowerCase()).toContain('no encontrado');
    });
  });

  describe('regresión de privacidad (HU9 / HU10)', () => {
    it('a un tercero sirve coordenadas aproximadas (~1km), nunca el punto exacto', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reportes/${reporteConFotosId}`)
        .set('X-User-Id', terceroId)
        .expect(200);

      expect(res.body.latitud).toBe(LAT_APROX);
      expect(res.body.longitud).toBe(LNG_APROX);
      expect(res.body.latitud).not.toBe(LAT_EXACTA);
      expect(res.body.longitud).not.toBe(LNG_EXACTA);
    });

    it('la respuesta nunca incluye email ni teléfono del propietario (ni siquiera al dueño)', async () => {
      const comoTercero = await request(app.getHttpServer())
        .get(`/reportes/${reporteConFotosId}`)
        .set('X-User-Id', terceroId)
        .expect(200);
      const comoDueno = await request(app.getHttpServer())
        .get(`/reportes/${reporteConFotosId}`)
        .set('X-User-Id', duenoId)
        .expect(200);

      for (const cuerpo of [comoTercero.body, comoDueno.body]) {
        const texto = JSON.stringify(cuerpo);
        expect(texto).not.toContain(DUENO_EMAIL);
        expect(texto).not.toContain(DUENO_TEL);
        expect(cuerpo.propietario).toBeUndefined();
        expect(cuerpo.email).toBeUndefined();
        expect(cuerpo.telefono).toBeUndefined();
      }
    });
  });
});
