import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const found = await prisma.user.findFirst({
    where: { email: { equals: 'elpepediaz10@yahoo.cl', mode: 'insensitive' } },
  });

  if (!found) {
    const all = await prisma.user.findMany({ select: { email: true, role: true } });
    console.log('Usuario no encontrado:', JSON.stringify(all, null, 2));
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { id: found.id },
    data: { role: 'ADMIN' },
  });
  console.log('Admin:', user.email);

  const course = await prisma.course.findFirst();
  const videos = await prisma.video.findMany({
    where: course ? { courseId: course.id } : {},
    orderBy: { order: 'asc' },
  });
  console.log('Curso:', course?.title ?? 'sin curso', course?.id ?? '-');
  videos.forEach((v) => console.log(`  ${v.order}. ${v.title}`));
} finally {
  await prisma.$disconnect();
}
