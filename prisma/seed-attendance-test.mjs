import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const testAttendees = [
  {
    email: 'asistio-sin-80@test-scai.cl',
    firstName: 'Pedro',
    lastName: 'SinOchenta',
    watchedOver80: false,
  },
  {
    email: 'asistio-con-80@test-scai.cl',
    firstName: 'Ana',
    lastName: 'ConOchenta',
    watchedOver80: true,
  },
];

try {
  for (const a of testAttendees) {
    await prisma.attendanceEligibility.upsert({
      where: { email: a.email },
      create: a,
      update: {
        firstName: a.firstName,
        lastName: a.lastName,
        watchedOver80: a.watchedOver80,
      },
    });
    const row = await prisma.attendanceEligibility.findUnique({
      where: { email: a.email },
      include: { certificate: true },
    });
    if (row?.certificate) {
      await prisma.attendanceCertificate.delete({ where: { id: row.certificate.id } });
    }
    console.log(`${a.email} | watchedOver80: ${a.watchedOver80}`);
  }
  console.log('Listo. Usa estos correos en /certificado/asistencia');
} finally {
  await prisma.$disconnect();
}
