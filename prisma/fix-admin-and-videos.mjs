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
    console.log('Usuario no encontrado. Usuarios en BD:', JSON.stringify(all, null, 2));
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { id: found.id },
    data: { role: 'ADMIN' },
  });
  console.log('Usuario actualizado:', user.email, user.role);

  const videos = await prisma.video.findMany({ orderBy: { createdAt: 'asc' } });
  console.log('Videos encontrados:', videos.map(v => `${v.id} | ${v.title}`));

  const keep = videos.find(v => v.title.toLowerCase().includes('asdasdas'));

  if (!keep) {
    console.log('No se encontró video con título "asdasdas". Se listan todos para revisión.');
    videos.forEach(v => console.log(v.id, v.title));
  } else {
    console.log('Video a conservar:', keep.id, keep.title);
    const toDelete = videos.filter(v => v.id !== keep.id);
    for (const v of toDelete) {
      await prisma.purchase.deleteMany({ where: { videoId: v.id } });
      await prisma.video.delete({ where: { id: v.id } });
      console.log('Eliminado:', v.id, v.title);
    }
    console.log('Listo. Solo queda:', keep.title);
  }
} finally {
  await prisma.$disconnect();
}
