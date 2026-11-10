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
/**
 * HU18 (SPRINT4_PLAN §3.3 y §3.11): el administrador sale solo de ADMIN_EMAIL
 * y ADMIN_PASSWORD. La contraseña se asigna solo al crear la cuenta; si el
 * correo ya existe, se le da el rol ADMIN sin tocar su contraseña. Sin las
 * variables no se crea ningún administrador.
 */
async function sembrarAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!email) {
    console.warn('Sin ADMIN_EMAIL: no se crea ningún administrador.');
    return;
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    await prisma.usuario.update({
      where: { id: existente.id },
      data: { rol: 'ADMIN' },
    });
    console.log(`Administrador listo: ${existente.id} (cuenta existente)`);
    return;
  }

  if (password.length < LARGO_MINIMO) {
    console.warn(
      `ADMIN_PASSWORD falta o tiene menos de ${LARGO_MINIMO} caracteres: ` +
        'no se crea el administrador.',
    );
    return;
  }
  const admin = await prisma.usuario.create({
    data: {
      nombre: 'Administrador',
      email,
      rol: 'ADMIN',
      passwordHash: await hashPassword(password),
    },
  });
  console.log(`Administrador creado: ${admin.id}`);
}

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

  await sembrarAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
