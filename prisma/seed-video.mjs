import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const video = await prisma.video.create({
    data: {
      title: 'Video de prueba',
      description: 'Solo para testing',
      url: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      priceClp: 9990,
      duration: 120,
      order: 1,
      published: true,
    },
  });

  console.log(JSON.stringify(video, null, 2));
} finally {
  await prisma.$disconnect();
}

