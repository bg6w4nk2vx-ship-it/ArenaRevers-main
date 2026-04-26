import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

async function waitForDb(retries = 10, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      await prisma.$disconnect();
      return;
    } catch (err) {
      await prisma.$disconnect();
      console.log(`DB not ready yet (attempt ${i}/${retries}), retrying in ${delayMs / 1000}s...`);
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  await waitForDb();

  const prisma = new PrismaClient();
  try {
    const arenasCount = await prisma.arena.count();

    if (arenasCount > 0) {
      console.log(`Database already initialized (arenas: ${arenasCount}). Skipping demo data init.`);
      return;
    }

    console.log('Database is empty. Initializing demo users, arenas, and images...');

    execSync('node prisma/seed.js', { stdio: 'inherit' });
    execSync('node prisma/generate-arenas.js', { stdio: 'inherit' });
    execSync('node prisma/add-default-arena-images.js', { stdio: 'inherit' });

    const finalArenas = await prisma.arena.count();
    const finalImages = await prisma.arenaImage.count();
    console.log(`Initialization complete (arenas: ${finalArenas}, images: ${finalImages}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('init-docker-data failed:', error.message);
  process.exit(1);
});
