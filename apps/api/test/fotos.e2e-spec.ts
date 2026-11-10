import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { uploadsDir } from '../src/storage/local-storage.service';
import { auth, crearUsuarioConSesion, sesionDemo } from './helpers/sesion';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('HU2 — POST /reportes/:id/fotos', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reporteId: string;
  let demoToken: string;
  // Archivos que esta prueba sube: los únicos que borra al terminar.
  const subidas: string[] = [];
  const registrar = (body: { url: string }[]): void => {
    subidas.push(...body.map((f) => path.basename(f.url)));
  };

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
    // HU16: el usuario demo inicia sesión de verdad (ya no es implícito).
    demoToken = (await sesionDemo(app, prisma)).token;

    const reporte = await prisma.reporte.create({
      data: {
        tipo: 'PERDIDA',
        especie: 'Perro',
        color: 'Blanco',
        caracteristicasDistintivas: 'Collar verde',
        estado: 'PERDIDA',
        propietarioId: (await sesionDemo(app, prisma)).id,
      },
    });
    reporteId = reporte.id;
  });

  afterAll(async () => {
    try {
      const dir = uploadsDir();
      if (path.basename(path.resolve(dir)) !== 'uploads-test') {
        throw new Error(`No se borran fotos fuera de uploads-test: ${dir}`);
      }
      for (const f of subidas) fs.rmSync(path.join(dir, f), { force: true });
    } finally {
      await prisma.coincidencia.deleteMany();
      await prisma.fotografia.deleteMany();
      await prisma.reporte.deleteMany();
      await app.close();
    }
  });

  it('AC1: sube una imagen válida y la asocia al reporte', async () => {
    const res = await request(app.getHttpServer())
      .post(`/reportes/${reporteId}/fotos`)
      .set(auth(demoToken))
      .attach('fotos', PNG_1x1, 'mascota.png')
      .expect(201);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ reporteId, orden: 0 });
    expect(res.body[0].url).toMatch(/^\/files\//);
    registrar(res.body);

    const guardada = await prisma.fotografia.findUnique({
      where: { id: res.body[0].id },
    });
    expect(guardada).not.toBeNull();
  });

  it('las fotos de las pruebas van a uploads-test, nunca a apps/api/uploads', () => {
    expect(path.basename(uploadsDir())).toBe('uploads-test');
    const nombre = subidas[0];
    expect(fs.existsSync(path.join(uploadsDir(), nombre))).toBe(true);
    expect(
      fs.existsSync(path.join(__dirname, '..', 'uploads', nombre)),
    ).toBe(false);
  });

  it('AC2: devuelve 400 con mensaje claro si el archivo no es una imagen válida', async () => {
    const res = await request(app.getHttpServer())
      .post(`/reportes/${reporteId}/fotos`)
      .set(auth(demoToken))
      .attach('fotos', Buffer.from('soy un archivo de texto'), 'notas.txt')
      .expect(400);

    expect(JSON.stringify(res.body)).toContain('no es una imagen');
  });

  it('AC3: las fotos nuevas se agregan sin borrar las existentes', async () => {
    const antes = await prisma.fotografia.count({ where: { reporteId } });
    expect(antes).toBe(1);

    const res = await request(app.getHttpServer())
      .post(`/reportes/${reporteId}/fotos`)
      .set(auth(demoToken))
      .attach('fotos', PNG_1x1, 'segunda.png')
      .attach('fotos', PNG_1x1, 'tercera.png')
      .expect(201);
    registrar(res.body);

    const despues = await prisma.fotografia.count({ where: { reporteId } });
    expect(despues).toBe(antes + 2);

    const ordenes = (
      await prisma.fotografia.findMany({
        where: { reporteId },
        orderBy: { orden: 'asc' },
      })
    ).map((f) => f.orden);
    expect(ordenes).toEqual([0, 1, 2]);
  });

  it('RNF-02: devuelve 400 si la imagen supera 5MB', async () => {
    const grande = await sharp({
      create: {
        width: 4000,
        height: 4000,
        channels: 3,
        background: { r: 10, g: 120, b: 200 },
      },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();

    if (grande.length <= 5 * 1024 * 1024) {
      const padded = Buffer.concat([grande, Buffer.alloc(5 * 1024 * 1024)]);
      await request(app.getHttpServer())
        .post(`/reportes/${reporteId}/fotos`)
        .set(auth(demoToken))
        .attach('fotos', padded, 'pesada.png')
        .expect(400);
      return;
    }

    await request(app.getHttpServer())
      .post(`/reportes/${reporteId}/fotos`)
      .set(auth(demoToken))
      .attach('fotos', grande, 'pesada.png')
      .expect(400);
  });

  it('HU16: sin sesión → 401 y otro usuario → 403; no se agrega ninguna foto', async () => {
    const antes = await prisma.fotografia.count({ where: { reporteId } });
    await request(app.getHttpServer())
      .post(`/reportes/${reporteId}/fotos`)
      .attach('fotos', PNG_1x1, 'anonima.png')
      .expect(401);
    const intruso = await crearUsuarioConSesion(app, prisma, {
      nombre: 'Intruso Fotos',
      email: `intruso-fotos-${Date.now()}@test.dev`,
    });
    await request(app.getHttpServer())
      .post(`/reportes/${reporteId}/fotos`)
      .set(auth(intruso.token))
      .attach('fotos', PNG_1x1, 'ajena.png')
      .expect(403);
    expect(await prisma.fotografia.count({ where: { reporteId } })).toBe(antes);
    await prisma.usuario.delete({ where: { id: intruso.id } });
  });

  it('devuelve 400 si el reporte no existe', async () => {
    await request(app.getHttpServer())
      .post('/reportes/no-existe/fotos')
      .set(auth(demoToken))
      .attach('fotos', PNG_1x1, 'x.png')
      .expect(400);
  });
});
