import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DEMO_EMAIL } from '../src/usuarios/current-user.provider';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('HU2 — POST /reportes/:id/fotos', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reporteId: string;

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

    const reporte = await prisma.reporte.create({
      data: {
        tipo: 'PERDIDA',
        especie: 'Perro',
        color: 'Blanco',
        caracteristicasDistintivas: 'Collar verde',
        estado: 'PERDIDA',
        // Sin X-User-Id la sesión simulada es el usuario demo: debe ser el
        // dueño, porque solo el propietario puede subir fotos.
        propietarioId: (
          await prisma.usuario.upsert({
            where: { email: DEMO_EMAIL },
            update: {},
            create: { nombre: 'Usuario Demo', email: DEMO_EMAIL },
          })
        ).id,
      },
    });
    reporteId = reporte.id;
  });

  afterAll(async () => {
    const uploads = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploads)) {
      for (const f of fs.readdirSync(uploads)) fs.rmSync(path.join(uploads, f));
    }
    await prisma.coincidencia.deleteMany();
    await prisma.fotografia.deleteMany();
    await prisma.reporte.deleteMany();
    await app.close();
  });

  it('AC1: sube una imagen válida y la asocia al reporte', async () => {
    const res = await request(app.getHttpServer())
      .post(`/reportes/${reporteId}/fotos`)
      .attach('fotos', PNG_1x1, 'mascota.png')
      .expect(201);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ reporteId, orden: 0 });
    expect(res.body[0].url).toMatch(/^\/files\//);

    const guardada = await prisma.fotografia.findUnique({
      where: { id: res.body[0].id },
    });
    expect(guardada).not.toBeNull();
  });

  it('AC2: devuelve 400 con mensaje claro si el archivo no es una imagen válida', async () => {
    const res = await request(app.getHttpServer())
      .post(`/reportes/${reporteId}/fotos`)
      .attach('fotos', Buffer.from('soy un archivo de texto'), 'notas.txt')
      .expect(400);

    expect(JSON.stringify(res.body)).toContain('no es una imagen');
  });

  it('AC3: las fotos nuevas se agregan sin borrar las existentes', async () => {
    const antes = await prisma.fotografia.count({ where: { reporteId } });
    expect(antes).toBe(1);

    await request(app.getHttpServer())
      .post(`/reportes/${reporteId}/fotos`)
      .attach('fotos', PNG_1x1, 'segunda.png')
      .attach('fotos', PNG_1x1, 'tercera.png')
      .expect(201);

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
        .attach('fotos', padded, 'pesada.png')
        .expect(400);
      return;
    }

    await request(app.getHttpServer())
      .post(`/reportes/${reporteId}/fotos`)
      .attach('fotos', grande, 'pesada.png')
      .expect(400);
  });

  it('devuelve 400 si el reporte no existe', async () => {
    await request(app.getHttpServer())
      .post('/reportes/no-existe/fotos')
      .attach('fotos', PNG_1x1, 'x.png')
      .expect(400);
  });

  it('quien no es el propietario recibe 403 y no se agrega ninguna foto', async () => {
    const antes = await prisma.fotografia.count({ where: { reporteId } });
    const intruso = await prisma.usuario.create({
      data: {
        nombre: 'Intruso Fotos',
        email: `intruso-fotos-${Date.now()}@test.dev`,
      },
    });
    await request(app.getHttpServer())
      .post(`/reportes/${reporteId}/fotos`)
      .set('X-User-Id', intruso.id)
      .attach('fotos', PNG_1x1, 'ajena.png')
      .expect(403);
    expect(await prisma.fotografia.count({ where: { reporteId } })).toBe(antes);
    await prisma.usuario.delete({ where: { id: intruso.id } });
  });
});
