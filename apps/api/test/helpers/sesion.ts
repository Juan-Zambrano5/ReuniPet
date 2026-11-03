import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hashPassword } from '../../src/auth/password-hasher';
import { TokenService } from '../../src/auth/token.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DEMO_EMAIL } from '../../src/usuarios/current-user.provider';

/**
 * HU16: las pruebas inician sesión de verdad (POST /auth/login) en lugar de
 * mandar X-User-Id. Todos los usuarios de prueba comparten esta contraseña;
 * el hash se calcula una vez por archivo para no pagar scrypt en cada usuario.
 */
export const PASSWORD_PRUEBA = 'clave-de-prueba-123';

let hashCompartido: Promise<string> | null = null;
export function hashDePrueba(): Promise<string> {
  hashCompartido ??= hashPassword(PASSWORD_PRUEBA);
  return hashCompartido;
}

/** Header de autorización listo para `.set(...)`. */
export function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function iniciarSesion(
  app: INestApplication,
  email: string,
  password: string = PASSWORD_PRUEBA,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  return (res.body as { token: string }).token;
}

/** Crea un usuario con contraseña y devuelve su id y un token válido. */
export async function crearUsuarioConSesion(
  app: INestApplication,
  prisma: PrismaService,
  datos: { nombre: string; email: string; telefono?: string },
): Promise<{ id: string; token: string }> {
  const usuario = await prisma.usuario.create({
    data: { ...datos, passwordHash: await hashDePrueba() },
  });
  return { id: usuario.id, token: await iniciarSesion(app, datos.email) };
}

/**
 * Sesión del usuario demo (reemplaza la vuelta implícita al demo que había sin
 * header). Si el demo aún no tiene contraseña se le asigna la de prueba; si ya
 * tiene una (p. ej. de DEMO_PASSWORD) se firma su token directamente.
 */
export async function sesionDemo(
  app: INestApplication,
  prisma: PrismaService,
): Promise<{ id: string; token: string }> {
  const demo = await prisma.usuario.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      nombre: 'Usuario Demo',
      email: DEMO_EMAIL,
      telefono: '0999999999',
    },
  });
  if (!demo.passwordHash) {
    await prisma.usuario.update({
      where: { id: demo.id },
      data: { passwordHash: await hashDePrueba() },
    });
    return { id: demo.id, token: await iniciarSesion(app, DEMO_EMAIL) };
  }
  // El demo ya tiene contraseña propia que las pruebas no conocen: se usa
  // el mismo TokenService de la app (no es un atajo del código de producción).
  return { id: demo.id, token: await app.get(TokenService).firmar(demo.id) };
}
