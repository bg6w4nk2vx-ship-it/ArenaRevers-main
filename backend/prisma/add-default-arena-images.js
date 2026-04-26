import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple placeholder images by sport type
const SPORT_IMAGES = {
  football: [
    'https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg',
    'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg',
  ],
  basketball: [
    'https://images.pexels.com/photos/1103834/pexels-photo-1103834.jpeg',
    'https://images.pexels.com/photos/1103835/pexels-photo-1103835.jpeg',
  ],
  volleyball: [
    'https://images.pexels.com/photos/618038/pexels-photo-618038.jpeg',
  ],
  tennis: [
    'https://images.pexels.com/photos/1405355/pexels-photo-1405355.jpeg',
  ],
  'table-tennis': [
    'https://images.pexels.com/photos/976873/pexels-photo-976873.jpeg',
  ],
  badminton: [
    'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg',
  ],
  futsal: [
    'https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg',
  ],
  other: [
    'https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg',
  ],
};

function getImagesForSport(sportType) {
  if (SPORT_IMAGES[sportType] && SPORT_IMAGES[sportType].length > 0) {
    return SPORT_IMAGES[sportType];
  }
  return SPORT_IMAGES.other;
}

async function main() {
  console.log('Добавление дефолтных картинок для арен...\n');

  const arenas = await prisma.arena.findMany({
    include: { images: true },
  });

  let updatedCount = 0;

  for (const arena of arenas) {
    if (arena.images && arena.images.length > 0) {
      continue;
    }

    const urls = getImagesForSport(arena.sportType);

    console.log(`Арене "${arena.title}" пока без изображений — добавляем ${urls.length} картинок`);

    for (let index = 0; index < urls.length; index++) {
      const url = urls[index];
      await prisma.arenaImage.create({
        data: {
          arenaId: arena.id,
          url,
          altText: `${arena.title} - image ${index + 1}`,
          order: index,
        },
      });
    }

    updatedCount += 1;
  }

  console.log(`\n✅ Обновлено арен: ${updatedCount}`);
}

main()
  .catch((e) => {
    console.error('Ошибка при добавлении картинок:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

