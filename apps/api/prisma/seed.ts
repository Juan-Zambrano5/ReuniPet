import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password-hasher';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@reunipet.app';
const LARGO_MINIMO = 8;

/**
 * HU16 (SPRINT4_PLAN §3.9): el usuario demo puede iniciar sesión con
 * DEMO_PASSWORD. La contraseña se asigna SOLO si todavía no tiene una, así que
 * cambiar la variable después no la modifica. Nunca se imprime la contraseña
 * ni el hash; sin la variable el seed sigue (el demo existe pero no puede entrar).
 */
async function main(): Promise<void> {
  const demo = await prisma.usuario.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      nombre: 'Usuario Demo',
      email: DEMO_EMAIL,
      telefono: '0999999999',
    },
  });

  const demoPassword = process.env.DEMO_PASSWORD ?? '';
  if (demo.passwordHash) {
    console.log(`Usuario demo listo: ${demo.id} (ya tiene contraseña)`);
  } else if (demoPassword.length >= LARGO_MINIMO) {
    await prisma.usuario.update({
      where: { id: demo.id },
      data: { passwordHash: await hashPassword(demoPassword) },
    });
    console.log(`Usuario demo listo: ${demo.id} (contraseña desde DEMO_PASSWORD)`);
  } else {
    console.warn(
      `Usuario demo ${demo.id} sin contraseña: define DEMO_PASSWORD ` +
        `(mínimo ${LARGO_MINIMO} caracteres) para poder iniciar sesión con él.`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
