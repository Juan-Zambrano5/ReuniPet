import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DEMO_EMAIL } from '../src/usuarios/current-user.provider';

const TERCERO_EMAIL = 'tercero-listado@test.dev';

describe('HU6 — GET /reportes (listado de reportes perdidos)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let demoId: string;
  let terceroId: string;
  let perdidaRecienteId: string;
  let perdidaAntiguaId: string;

  async function limpiar(): Promise<void> {
    await prisma.coincidencia.deleteMany();
    await prisma.fotografia.deleteMany();
    await prisma.reporte.deleteMany();
    await prisma.usuario.deleteMany({
      where: { email: TERCERO_EMAIL },
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

    const demo = await prisma.usuario.findUniqueOrThrow({
      where: { email: DEMO_EMAIL },
    });
    demoId = demo.id;
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  describe('AC2: sin reportes activos', () => {
    beforeAll(async () => {
      await limpiar();
    });

    it('devuelve la lista vacía con meta.total 0 (no una lista en blanco)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA')
        .expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.meta).toMatchObject({ total: 0, page: 1 });
    });

    it('HU7 AC2: también devuelve vacía la lista de ENCONTRADA', async () => {
      const res = await request(app.getHttpServer())
        .get('/reportes?tipo=ENCONTRADA')
        .expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.meta).toMatchObject({ total: 0, page: 1 });
    });
  });

  describe('con reportes sembrados', () => {
    beforeAll(async () => {
      await limpiar();

      const tercero = await prisma.usuario.create({
        data: {
          nombre: 'Tercero',
          email: TERCERO_EMAIL,
          telefono: '04120000001',
        },
      });
      terceroId = tercero.id;

      const reciente = await prisma.reporte.create({
        data: {
          tipo: 'PERDIDA',
          especie: 'Perro',
          raza: 'Labrador',
          color: 'negro',
          caracteristicasDistintivas: 'collar rojo',
          ubicacion: 'Parque Central',
          latitud: 10.5,
          longitud: -66.5,
          estado: 'PERDIDA',
          propietarioId: demoId,
          createdAt: new Date('2026-09-28T10:00:00.000Z'),
        },
      });
      perdidaRecienteId = reciente.id;
      await prisma.fotografia.create({
        data: {
          reporteId: reciente.id,
          url: '/files/perro-labrador.jpg',
          orden: 0,
        },
      });

      const antigua = await prisma.reporte.create({
        data: {
          tipo: 'PERDIDA',
          especie: 'Gato',
          color: 'blanco',
          caracteristicasDistintivas: 'oreja cortada',
          ubicacion: 'Av. Central',
          latitud: 10.12345,
          longitud: -66.98765,
          estado: 'PERDIDA',
          propietarioId: terceroId,
          createdAt: new Date('2026-09-27T10:00:00.000Z'),
        },
      });
      perdidaAntiguaId = antigua.id;

      // NO debe aparecer en el listado de perdidas (HU6)
      await prisma.reporte.create({
        data: {
          tipo: 'ENCONTRADA',
          especie: 'Canario',
          color: 'amarillo',
          caracteristicasDistintivas: 'pico roto',
          ubicacion: 'Calle 5',
          estado: 'ENCONTRADA',
          propietarioId: demoId,
          createdAt: new Date('2026-09-28T12:00:00.000Z'),
        },
      });
    });

    it('AC1: lista solo PERDIDA, de más a menos reciente, con foto principal', async () => {
      const res = await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA')
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);

      const [primero, segundo] = res.body.items;
      expect(primero.id).toBe(perdidaRecienteId);
      expect(segundo.id).toBe(perdidaAntiguaId);

      expect(primero).toMatchObject({
        tipo: 'PERDIDA',
        especie: 'Perro',
        raza: 'Labrador',
        color: 'negro',
        estado: 'PERDIDA',
        ubicacion: 'Parque Central',
      });
      expect(primero.createdAt).toBe('2026-09-28T10:00:00.000Z');
      expect(primero.fotoPrincipal).toMatchObject({
        url: '/files/perro-labrador.jpg',
      });
      expect(segundo.fotoPrincipal).toBeNull();

      const especies = res.body.items.map(
        (i: { especie: string }) => i.especie,
      );
      expect(especies).not.toContain('Canario');
    });

    it('HU9: al propietario le sirve coordenadas exactas y a terceros aproximadas', async () => {
      const res = await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA')
        .expect(200);

      const propietario = res.body.items.find(
        (i: { id: string }) => i.id === perdidaRecienteId,
      );
      expect(propietario.esPropietario).toBe(true);
      expect(propietario.latitud).toBe(10.5);
      expect(propietario.longitud).toBe(-66.5);

      const ajeno = res.body.items.find(
        (i: { id: string }) => i.id === perdidaAntiguaId,
      );
      expect(ajeno.esPropietario).toBe(false);
      expect(ajeno.latitud).toBe(10.12);
      expect(ajeno.longitud).toBe(-66.99);
    });

    it('AC3: desde el listado, el detalle del reporte responde con sus datos básicos', async () => {
      const listado = await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA')
        .expect(200);

      const id = listado.body.items[0].id;
      const detalle = await request(app.getHttpServer())
        .get(`/reportes/${id}`)
        .expect(200);

      expect(detalle.body).toMatchObject({
        id,
        tipo: 'PERDIDA',
        especie: 'Perro',
        raza: 'Labrador',
        color: 'negro',
        estado: 'PERDIDA',
        ubicacion: 'Parque Central',
      });
      expect(detalle.body.fotos[0].url).toBe('/files/perro-labrador.jpg');
    });

    it('paginación: page/limit recortan los items y reflejan meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA&page=1&limit=1')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
    });

    it('HU7 AC1: lista ENCONTRADA de más a menos reciente, sin reportes perdidos', async () => {
      const res = await request(app.getHttpServer())
        .get('/reportes?tipo=ENCONTRADA')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        tipo: 'ENCONTRADA',
        estado: 'ENCONTRADA',
        especie: 'Canario',
        color: 'amarillo',
        ubicacion: 'Calle 5',
      });
      expect(res.body.items[0].createdAt).toBe('2026-09-28T12:00:00.000Z');
    });

    it('HU7 AC3: desde el listado de encontradas, el detalle responde con sus datos', async () => {
      const listado = await request(app.getHttpServer())
        .get('/reportes?tipo=ENCONTRADA')
        .expect(200);

      const id = listado.body.items[0].id;
      const detalle = await request(app.getHttpServer())
        .get(`/reportes/${id}`)
        .expect(200);

      expect(detalle.body).toMatchObject({
        id,
        tipo: 'ENCONTRADA',
        especie: 'Canario',
        estado: 'ENCONTRADA',
        ubicacion: 'Calle 5',
      });
    });

    it('HU7: sin tipo lista ambos tipos a la vez', async () => {
      const res = await request(app.getHttpServer())
        .get('/reportes')
        .expect(200);

      expect(res.body.items).toHaveLength(3);
      const tipos = res.body.items.map((i: { tipo: string }) => i.tipo);
      expect(tipos).toContain('PERDIDA');
      expect(tipos).toContain('ENCONTRADA');
    });

    it('valida los query params: page y limit fuera de rango', async () => {
      await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA&page=0')
        .expect(400);
      await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA&limit=100')
        .expect(400);
      await request(app.getHttpServer())
        .get('/reportes?tipo=PERDIDA&foo=bar')
        .expect(400);
    });
  });
});
