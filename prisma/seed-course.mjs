import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existingCourses = await prisma.course.findMany();
  if (existingCourses.length > 0) {
    console.log('Ya existe un curso, actualizando precio, videos y examen...');
    const course = existingCourses[0];

    await prisma.course.update({
      where: { id: course.id },
      data: { priceClp: 29750 },
    });

    await prisma.video.updateMany({
      where: {},
      data: { courseId: course.id },
    });

    await prisma.exam.updateMany({
      where: {},
      data: { courseId: course.id },
    });

    console.log(`Curso: ${course.title} (${course.id}) priceClp=29750`);
    const videos = await prisma.video.findMany({ orderBy: { order: 'asc' } });
    videos.forEach((v) => console.log(`  Video: ${v.title} -> courseId: ${v.courseId}`));
    const exams = await prisma.exam.findMany();
    exams.forEach((e) => console.log(`  Examen: ${e.title} -> courseId: ${e.courseId}`));
    return;
  }

  const course = await prisma.course.create({
    data: {
      title: 'Curso de Inmunología Clínica',
      description: 'Curso completo de inmunología clínica aplicada. Incluye todos los módulos y episodios.',
      priceClp: 29750,
      published: true,
    },
  });

  console.log(`Curso creado: ${course.title} (${course.id})`);

  await prisma.video.updateMany({
    where: {},
    data: { courseId: course.id },
  });

  await prisma.exam.updateMany({
    where: {},
    data: { courseId: course.id },
  });

  const videos = await prisma.video.findMany({ orderBy: { order: 'asc' } });
  videos.forEach((v) => console.log(`  Video vinculado: ${v.title}`));
  const exams = await prisma.exam.findMany();
  exams.forEach((e) => console.log(`  Examen vinculado: ${e.title}`));

  console.log('Seed completado');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
