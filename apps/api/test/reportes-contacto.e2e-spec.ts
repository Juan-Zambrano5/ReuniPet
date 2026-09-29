import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DEMO_EMAIL } from '../src/usuarios/current-user.provider';

const DUENO_EMAIL = 'dueno-contacto@test.dev';
const SOLICITANTE_EMAIL = 'solicitante-contacto@test.dev';

describe('HU10 — GET /reportes/:id/contacto', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let duenoId: string;
  let solicitanteId: string;
  let reporteId: string;

  async function limpiar(): Promise<void> {
    await prisma.coincidencia.deleteMany();
    await prisma.contactoSolicitud.deleteMany();
    await prisma.fotografia.deleteMany();
    await prisma.reporte.deleteMany();
    await prisma.usuario.deleteMany({
      where: { email: { in: [DUENO_EMAIL, SOLICITANTE_EMAIL] } },
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
        nombre: 'María Pérez',
        email: DUENO_EMAIL,
        telefono: '04121234567',
      },
    });
    duenoId = dueno.id;

    const solicitante = await prisma.usuario.create({
      data: {
        nombre: 'Carlos López',
        email: SOLICITANTE_EMAIL,
        telefono: '04147654321',
      },
    });
    solicitanteId = solicitante.id;

    const reporte = await prisma.reporte.create({
      data: {
        tipo: 'ENCONTRADA',
        especie: 'Perro',
        color: 'negro',
        caracteristicasDistintivas: 'collar rojo',
        ubicacion: 'Parque Central',
        estado: 'ENCONTRADA',
        propietarioId: duenoId,
      },
    });
    reporteId = reporte.id;
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  it('AC1: devuelve el nombre y un medio de contacto del reportante', async () => {
    const res = await request(app.getHttpServer())
      .get(`/reportes/${reporteId}/contacto`)
      .set('X-User-Id', solicitanteId)
      .expect(200);

    expect(res.body).toEqual({
      reporteId,
      nombre: 'María Pérez',
      email: DUENO_EMAIL,
      telefono: '04121234567',
    });
  });

  it('AC2: deja registrado quién solicitó el contacto y cuándo', async () => {
    const solicitudes = await prisma.contactoSolicitud.findMany({
      where: { reporteId },
      orderBy: { createdAt: 'asc' },
    });

    expect(solicitudes.length).toBeGreaterThanOrEqual(1);
    const ultima = solicitudes[solicitudes.length - 1];
    expect(ultima.solicitanteId).toBe(solicitanteId);
    expect(ultima.createdAt).toBeInstanceOf(Date);
  });

  it('AC3: funciona bajo la sesión simulada (sin header → usuario demo)', async () => {
    const demo = await prisma.usuario.findUniqueOrThrow({
      where: { email: DEMO_EMAIL },
    });

    await request(app.getHttpServer())
      .get(`/reportes/${reporteId}/contacto`)
      .expect(200);

    const delDemo = await prisma.contactoSolicitud.findFirst({
      where: { reporteId, solicitanteId: demo.id },
    });
    expect(delDemo).not.toBeNull();
  });

  it('AC3: cada consulta queda registrada (dos solicitudes → dos registros)', async () => {
    const antes = await prisma.contactoSolicitud.count({
      where: { reporteId, solicitanteId },
    });

    await request(app.getHttpServer())
      .get(`/reportes/${reporteId}/contacto`)
      .set('X-User-Id', solicitanteId)
      .expect(200);

    const despues = await prisma.contactoSolicitud.count({
      where: { reporteId, solicitanteId },
    });
    expect(despues).toBe(antes + 1);
  });

  it('reporte inexistente → 404 y no registra nada', async () => {
    const antes = await prisma.contactoSolicitud.count();

    await request(app.getHttpServer())
      .get('/reportes/no-existe-123/contacto')
      .set('X-User-Id', solicitanteId)
      .expect(404);

    const despues = await prisma.contactoSolicitud.count();
    expect(despues).toBe(antes);
  });

  it('sesión inválida (header con id inexistente) → 401', async () => {
    await request(app.getHttpServer())
      .get(`/reportes/${reporteId}/contacto`)
      .set('X-User-Id', 'id-que-no-existe')
      .expect(401);
  });
});
