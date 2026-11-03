import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const ANA_EMAIL = 'ana-mis-reportes@test.dev';
const BETO_EMAIL = 'beto-mis-reportes@test.dev';

interface MiReporte {
  id: string;
  tipo: string;
  especie: string;
  estado: string;
  esPropietario: boolean;
  latitud: number | null;
  createdAt: string;
  fotoPrincipal: { url: string } | null;
  coincidenciasPendientes: number;
}

describe('HU15 — GET /usuarios/me/reportes', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let anaId: string;
  let betoId: string;

  async function limpiarReportes(): Promise<void> {
    const ids = [anaId, betoId].filter(Boolean);
    const reportes = await prisma.reporte.findMany({
      where: { propietarioId: { in: ids } },
      select: { id: true },
    });
    const reporteIds = reportes.map((r) => r.id);
    await prisma.coincidencia.deleteMany({
      where: {
        OR: [
          { reportePerdidaId: { in: reporteIds } },
          { reporteEncontradaId: { in: reporteIds } },
        ],
      },
    });
    await prisma.fotografia.deleteMany({
      where: { reporteId: { in: reporteIds } },
    });
    await prisma.reporte.deleteMany({ where: { id: { in: reporteIds } } });
  }

  async function crear(
    propietarioId: string,
    datos: Partial<{
      tipo: 'PERDIDA' | 'ENCONTRADA';
      especie: string;
      estado: 'PERDIDA' | 'ENCONTRADA' | 'RECUPERADA';
      createdAt: Date;
    }> = {},
  ): Promise<string> {
    const tipo = datos.tipo ?? 'PERDIDA';
    const r = await prisma.reporte.create({
      data: {
        tipo,
        especie: datos.especie ?? 'Perro',
        color: 'Negro',
        caracteristicasDistintivas: 'Collar rojo',
        estado: datos.estado ?? tipo,
        propietarioId,
        latitud: 4.711234,
        longitud: -74.072099,
        createdAt: datos.createdAt,
      },
    });
    return r.id;
  }

  function misReportes(userId: string): Promise<MiReporte[]> {
    return request(app.getHttpServer())
      .get('/usuarios/me/reportes')
      .set('X-User-Id', userId)
      .expect(200)
      .then((res) => res.body as MiReporte[]);
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

    const previos = await prisma.usuario.findMany({
      where: { email: { in: [ANA_EMAIL, BETO_EMAIL] } },
    });
    anaId = previos.find((u) => u.email === ANA_EMAIL)?.id ?? '';
    betoId = previos.find((u) => u.email === BETO_EMAIL)?.id ?? '';
    await limpiarReportes();
    await prisma.usuario.deleteMany({
      where: { email: { in: [ANA_EMAIL, BETO_EMAIL] } },
    });

    anaId = (
      await prisma.usuario.create({ data: { nombre: 'Ana', email: ANA_EMAIL } })
    ).id;
    betoId = (
      await prisma.usuario.create({ data: { nombre: 'Beto', email: BETO_EMAIL } })
    ).id;
  });

  afterEach(async () => {
    await limpiarReportes();
  });

  afterAll(async () => {
    await limpiarReportes();
    await prisma.usuario.deleteMany({
      where: { email: { in: [ANA_EMAIL, BETO_EMAIL] } },
    });
    await app.close();
  });

  it('AC1: devuelve todos los reportes propios (incluidos RECUPERADA), del más reciente al más antiguo', async () => {
    const viejo = await crear(anaId, {
      especie: 'Gato',
      estado: 'RECUPERADA',
      createdAt: new Date('2026-10-01T00:00:00Z'),
    });
    const medio = await crear(anaId, {
      tipo: 'ENCONTRADA',
      createdAt: new Date('2026-10-15T00:00:00Z'),
    });
    const nuevo = await crear(anaId, {
      createdAt: new Date('2026-11-01T00:00:00Z'),
    });
    await prisma.fotografia.create({
      data: { reporteId: nuevo, url: '/files/nuevo.webp', orden: 0 },
    });

    const items = await misReportes(anaId);

    expect(items.map((i) => i.id)).toEqual([nuevo, medio, viejo]);
    expect(items.map((i) => i.estado)).toEqual([
      'PERDIDA',
      'ENCONTRADA',
      'RECUPERADA',
    ]);
    expect(items[0].fotoPrincipal?.url).toBe('/files/nuevo.webp');
    expect(items[1].fotoPrincipal).toBeNull();
    // Son del propietario: coordenadas exactas, sin aproximar.
    expect(items.every((i) => i.esPropietario)).toBe(true);
    expect(items[0].latitud).toBe(4.711234);

    // El RECUPERADA no está en el listado público, pero sí en "mis reportes".
    const publico = await request(app.getHttpServer())
      .get('/reportes?limit=50')
      .set('X-User-Id', anaId)
      .expect(200);
    const idsPublicos = (publico.body as { items: { id: string }[] }).items.map(
      (i) => i.id,
    );
    expect(idsPublicos).not.toContain(viejo);
  });

  it('AC2: cuenta las coincidencias que muestra /alertas (sin descartadas ni recuperadas)', async () => {
    const perdida = await crear(anaId);
    const enc1 = await crear(betoId, { tipo: 'ENCONTRADA' });
    const enc2 = await crear(betoId, { tipo: 'ENCONTRADA' });
    const encDescartada = await crear(betoId, { tipo: 'ENCONTRADA' });
    const encRecuperada = await crear(betoId, {
      tipo: 'ENCONTRADA',
      estado: 'RECUPERADA',
    });
    await prisma.coincidencia.createMany({
      data: [
        { reportePerdidaId: perdida, reporteEncontradaId: enc1, score: 1 },
        {
          reportePerdidaId: perdida,
          reporteEncontradaId: enc2,
          score: 0.7,
          estado: 'VISTA',
        },
        {
          reportePerdidaId: perdida,
          reporteEncontradaId: encDescartada,
          score: 0.7,
          estado: 'DESCARTADA',
        },
        {
          reportePerdidaId: perdida,
          reporteEncontradaId: encRecuperada,
          score: 0.7,
        },
      ],
    });

    const [item] = await misReportes(anaId);
    expect(item.id).toBe(perdida);
    expect(item.coincidenciasPendientes).toBe(2);

    // Es el mismo número que el usuario ve al ir a /alertas.
    const alertas = await request(app.getHttpServer())
      .get('/usuarios/me/alertas')
      .set('X-User-Id', anaId)
      .expect(200);
    expect(alertas.body).toHaveLength(2);

    // Al marcar su reporte RECUPERADA deja de mostrar pendientes.
    await request(app.getHttpServer())
      .patch(`/reportes/${perdida}/estado`)
      .set('X-User-Id', anaId)
      .send({ estado: 'RECUPERADA' })
      .expect(200);
    const [cerrado] = await misReportes(anaId);
    expect(cerrado.coincidenciasPendientes).toBe(0);
  });

  it('AC3: un usuario sin reportes recibe una lista vacía', async () => {
    await expect(misReportes(anaId)).resolves.toEqual([]);
  });

  it('AC3: aislamiento — cada usuario ve solo los suyos', async () => {
    const deAna = await crear(anaId);
    const deBeto = await crear(betoId, { tipo: 'ENCONTRADA' });

    const ana = await misReportes(anaId);
    const beto = await misReportes(betoId);

    expect(ana.map((i) => i.id)).toEqual([deAna]);
    expect(beto.map((i) => i.id)).toEqual([deBeto]);
  });

  it('regresión: la respuesta no incluye datos de contacto del propietario', async () => {
    await crear(anaId);
    const res = await request(app.getHttpServer())
      .get('/usuarios/me/reportes')
      .set('X-User-Id', anaId)
      .expect(200);
    const texto = JSON.stringify(res.body);
    expect(texto).not.toContain(ANA_EMAIL);
    expect(texto).not.toMatch(/telefono|passwordHash/);
  });

  it('un X-User-Id inexistente → 401', async () => {
    await request(app.getHttpServer())
      .get('/usuarios/me/reportes')
      .set('X-User-Id', '00000000-0000-0000-0000-000000000000')
      .expect(401);
  });
});
