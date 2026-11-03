import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { auth, hashDePrueba, PASSWORD_PRUEBA } from './helpers/sesion';

const EMAIL = 'login-hu16@test.dev';
const EMAIL_BLOQUEO = 'login-hu16-bloqueo@test.dev';
const EMAILS = [EMAIL, EMAIL_BLOQUEO];

interface LoginBody {
  token: string;
  usuario: { id: string; nombre: string; email: string };
}

describe('HU16 — POST /auth/login', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usuarioId: string;

  function login(email: string, password: string): request.Test {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
  }

  async function limpiar(): Promise<void> {
    const usuarios = await prisma.usuario.findMany({
      where: { email: { in: EMAILS } },
      select: { id: true },
    });
    const ids = usuarios.map((u) => u.id);
    await prisma.reporte.deleteMany({ where: { propietarioId: { in: ids } } });
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
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

    const hash = await hashDePrueba();
    usuarioId = (
      await prisma.usuario.create({
        data: { nombre: 'Lucía Login', email: EMAIL, passwordHash: hash },
      })
    ).id;
    await prisma.usuario.create({
      data: { nombre: 'Bloqueo', email: EMAIL_BLOQUEO, passwordHash: hash },
    });
  });

  afterAll(async () => {
    delete process.env.AUTH_MODE;
    await limpiar();
    await app.close();
  });

  it('AC1: credenciales válidas → 200 con token, y el token actúa como esa cuenta', async () => {
    const res = await login(` ${EMAIL.toUpperCase()} `, PASSWORD_PRUEBA).expect(
      200,
    );
    const body = res.body as LoginBody;
    expect(body.token.split('.')).toHaveLength(3);
    expect(body.usuario).toMatchObject({
      id: usuarioId,
      nombre: 'Lucía Login',
      email: EMAIL,
    });
    const texto = JSON.stringify(body);
    expect(texto).not.toContain(PASSWORD_PRUEBA);
    expect(texto).not.toContain('scrypt$');

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set(auth(body.token))
      .expect(200);
    expect((me.body as { id: string }).id).toBe(usuarioId);

    const reporte = await request(app.getHttpServer())
      .post('/reportes')
      .set(auth(body.token))
      .send({
        tipo: 'PERDIDA',
        especie: 'Perro',
        color: 'Negro',
        caracteristicasDistintivas: 'Collar rojo',
      })
      .expect(201);
    const creado = await prisma.reporte.findUnique({
      where: { id: (reporte.body as { id: string }).id },
    });
    expect(creado?.propietarioId).toBe(usuarioId);
  });

  it('AC1: el token vence a las 8 horas', async () => {
    const res = await login(EMAIL, PASSWORD_PRUEBA).expect(200);
    const carga = app
      .get(JwtService)
      .decode<{ iat: number; exp: number }>((res.body as LoginBody).token);
    expect(carga.exp - carga.iat).toBe(8 * 60 * 60);
  });

  it('AC2: contraseña incorrecta y correo inexistente dan el mismo 401 y mensaje', async () => {
    const malaClave = await login(EMAIL, 'otra-clave-123').expect(401);
    const sinCuenta = await login('nadie-hu16@test.dev', PASSWORD_PRUEBA).expect(
      401,
    );
    for (const res of [malaClave, sinCuenta]) {
      expect((res.body as { message: string }).message).toBe(
        'Correo o contraseña incorrectos',
      );
      expect(res.body).not.toHaveProperty('token');
    }
  });

  it('AC2: datos mal formados → 400 sin eco de la contraseña', async () => {
    const res = await login('no-es-correo', 'clave-secreta-x').expect(400);
    expect(JSON.stringify(res.body)).not.toContain('clave-secreta-x');
  });

  it('AC3: tras 5 fallos seguidos responde 429, incluso con la contraseña correcta', async () => {
    for (let i = 0; i < 5; i++) {
      await login(EMAIL_BLOQUEO, `mala-${i}-clave`).expect(401);
    }
    const bloqueado = await login(EMAIL_BLOQUEO, PASSWORD_PRUEBA).expect(429);
    expect((bloqueado.body as { message: string }).message).toContain(
      '15 minutos',
    );
    expect(bloqueado.body).not.toHaveProperty('token');
    // El bloqueo es por correo: otra cuenta sigue entrando.
    await login(EMAIL, PASSWORD_PRUEBA).expect(200);
  });

  it('AC4: sin token, con token alterado o vencido, las rutas privadas responden 401', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set(auth('no.es.jwt'))
      .expect(401);

    const vencido = await app
      .get(JwtService)
      .signAsync({ sub: usuarioId }, { expiresIn: -10 });
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set(auth(vencido))
      .expect(401);
    expect((res.body as { message: string }).message).toBe(
      'Tu sesión expiró o no es válida',
    );

    // Un token firmado con otro secreto tampoco sirve.
    const ajeno = await new JwtService({
      secret: 'otro-secreto-de-al-menos-32-caracteres!!',
    }).signAsync({ sub: usuarioId });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set(auth(ajeno))
      .expect(401);
  });

  it('X-User-Id solo se acepta con AUTH_MODE=dev', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-User-Id', usuarioId)
      .expect(401);

    process.env.AUTH_MODE = 'dev';
    try {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('X-User-Id', usuarioId)
        .expect(200);
      expect((res.body as { id: string }).id).toBe(usuarioId);
    } finally {
      delete process.env.AUTH_MODE;
    }
  });
});
