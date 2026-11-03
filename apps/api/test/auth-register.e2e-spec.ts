import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { verifyPassword } from '../src/auth/password-hasher';
import { DEMO_EMAIL } from '../src/usuarios/current-user.provider';

const EMAIL = 'registro-hu12@test.dev';
const OTRO_EMAIL = 'registro-hu12-b@test.dev';
const PASSWORD = 'clave-segura-123';

interface UsuarioBody {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  createdAt: string;
}

describe('HU12 — POST /auth/register', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function limpiar(): Promise<void> {
    const usuarios = await prisma.usuario.findMany({
      where: { email: { in: [EMAIL, OTRO_EMAIL] } },
      select: { id: true },
    });
    const ids = usuarios.map((u) => u.id);
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
    await prisma.reporte.deleteMany({ where: { id: { in: reporteIds } } });
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
  }

  function registrar(body: Record<string, unknown>): request.Test {
    return request(app.getHttpServer()).post('/auth/register').send(body);
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
  });

  afterEach(async () => {
    await limpiar();
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  it('AC1: crea la cuenta (201) y el id sirve como sesión para publicar y gestionar reportes', async () => {
    const res = await registrar({
      nombre: 'Ana Registro',
      email: EMAIL,
      telefono: '3001234567',
      password: PASSWORD,
    }).expect(201);
    const usuario = res.body as UsuarioBody;

    expect(Object.keys(usuario).sort()).toEqual(
      ['createdAt', 'email', 'id', 'nombre', 'telefono'].sort(),
    );
    expect(usuario).toMatchObject({
      nombre: 'Ana Registro',
      email: EMAIL,
      telefono: '3001234567',
    });

    const guardado = await prisma.usuario.findUniqueOrThrow({
      where: { id: usuario.id },
    });
    expect(guardado.passwordHash).not.toBeNull();
    expect(guardado.passwordHash).not.toBe(PASSWORD);
    await expect(
      verifyPassword(PASSWORD, guardado.passwordHash as string),
    ).resolves.toBe(true);

    const reporte = await request(app.getHttpServer())
      .post('/reportes')
      .set('X-User-Id', usuario.id)
      .send({
        tipo: 'PERDIDA',
        especie: 'Perro',
        color: 'Negro',
        caracteristicasDistintivas: 'Collar rojo',
      })
      .expect(201);
    const reporteBody = reporte.body as { id: string; propietarioId: string };
    expect(reporteBody.propietarioId).toBe(usuario.id);

    const detalle = await request(app.getHttpServer())
      .get(`/reportes/${reporteBody.id}`)
      .set('X-User-Id', usuario.id)
      .expect(200);
    expect((detalle.body as { esPropietario: boolean }).esPropietario).toBe(
      true,
    );
  });

  it('AC2: correo ya registrado (con mayúsculas y espacios) → 409 sin duplicar', async () => {
    await registrar({ nombre: 'Ana', email: EMAIL, password: PASSWORD }).expect(
      201,
    );
    const res = await registrar({
      nombre: 'Ana 2',
      email: `  ${EMAIL.toUpperCase()} `,
      password: PASSWORD,
    }).expect(409);

    expect((res.body as { message: string }).message).toBe(
      'El correo ya está registrado',
    );
    expect(
      await prisma.usuario.count({
        where: { email: { equals: EMAIL, mode: 'insensitive' } },
      }),
    ).toBe(1);
  });

  it('AC2: el correo se guarda siempre en minúsculas', async () => {
    const res = await registrar({
      nombre: 'Bea',
      email: ' Registro-HU12-B@Test.DEV ',
      password: PASSWORD,
    }).expect(201);
    expect((res.body as UsuarioBody).email).toBe(OTRO_EMAIL);
  });

  it.each<[string, Record<string, unknown>, string]>([
    [
      'correo con formato incorrecto',
      { nombre: 'Ana', email: 'no-es-correo', password: PASSWORD },
      'correo',
    ],
    [
      'contraseña de menos de 8 caracteres',
      { nombre: 'Ana', email: EMAIL, password: '1234567' },
      '8 caracteres',
    ],
    ['sin nombre', { email: EMAIL, password: PASSWORD }, 'nombre'],
    ['sin contraseña', { nombre: 'Ana', email: EMAIL }, 'contraseña'],
    [
      'campo no permitido',
      { nombre: 'Ana', email: EMAIL, password: PASSWORD, passwordHash: 'x' },
      'passwordHash',
    ],
  ])('AC3: %s → 400 y no crea la cuenta', async (_caso, body, fragmento) => {
    const res = await registrar(body).expect(400);
    expect(JSON.stringify((res.body as { message: unknown }).message)).toContain(
      fragmento,
    );
    expect(await prisma.usuario.count({ where: { email: EMAIL } })).toBe(0);
  });

  it('ninguna respuesta incluye la contraseña ni su hash', async () => {
    const ok = await registrar({
      nombre: 'Ana',
      email: EMAIL,
      password: PASSWORD,
    }).expect(201);
    const dup = await registrar({
      nombre: 'Ana',
      email: EMAIL,
      password: PASSWORD,
    }).expect(409);
    const corta = await registrar({
      nombre: 'Ana',
      email: OTRO_EMAIL,
      password: 'corta77',
    }).expect(400);

    const { passwordHash } = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL },
    });
    for (const res of [ok, dup, corta]) {
      const texto = JSON.stringify(res.body);
      expect(texto).not.toContain(PASSWORD);
      expect(texto).not.toContain('corta77');
      expect(texto).not.toContain(passwordHash as string);
      expect(texto).not.toContain('scrypt$');
    }
    expect(ok.body).not.toHaveProperty('password');
    expect(ok.body).not.toHaveProperty('passwordHash');
  });

  it('regresión: sin X-User-Id sigue actuando el usuario demo (sin contraseña)', async () => {
    const demo = await prisma.usuario.findUniqueOrThrow({
      where: { email: DEMO_EMAIL },
    });
    expect(demo.passwordHash).toBeNull();
    const res = await request(app.getHttpServer())
      .get('/usuarios/me/alertas')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
