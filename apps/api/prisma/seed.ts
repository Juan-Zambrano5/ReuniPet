import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const demo = await prisma.usuario.upsert({
    where: { email: 'demo@reunipet.app' },
    update: {},
    create: {
      nombre: 'Usuario Demo',
      email: 'demo@reunipet.app',
      telefono: '0999999999',
    },
  });
  // eslint-disable-next-line no-console
  console.log(`Usuario demo listo: ${demo.id} (X-User-Id)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
