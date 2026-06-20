import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const testAttendees = [
  {
    email: 'asistio-con-80@test-scai.cl',
    firstName: 'Ana',
    lastName: 'ConOchenta',
    watchedOver50: true,
  },
  {
    email: 'asistio-sin-80@test-scai.cl',
    firstName: 'Pedro',
    lastName: 'SinOchenta',
    watchedOver50: false,
  },
  {
    email: 'maria-80@test-scai.cl',
    firstName: 'María',
    lastName: 'González',
    watchedOver50: true,
  },
  {
    email: 'carlos-sin-80@test-scai.cl',
    firstName: 'Carlos',
    lastName: 'Muñoz',
    watchedOver50: false,
  },
  {
    email: 'laura-80@test-scai.cl',
    firstName: 'Laura',
    lastName: 'Vega',
    watchedOver50: true,
  },
  {
    email: 'diego-sin-80@test-scai.cl',
    firstName: 'Diego',
    lastName: 'Rojas',
    watchedOver50: false,
  },
  {
    email: 'sofia-80@test-scai.cl',
    firstName: 'Sofía',
    lastName: 'Herrera',
    watchedOver50: true,
  },
  {
    email: 'jorge-sin-80@test-scai.cl',
    firstName: 'Jorge',
    lastName: 'Silva',
    watchedOver50: false,
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
        watchedOver50: a.watchedOver50,
      },
    });
    const row = await prisma.attendanceEligibility.findUnique({
      where: { email: a.email },
      include: { certificates: true, examAttempts: true },
    });
    if (row?.certificates.length) {
      await prisma.attendanceCertificate.deleteMany({ where: { eligibilityId: row.id } });
    }
    if (row?.examAttempts.length) {
      await prisma.attendanceExamAttempt.deleteMany({ where: { eligibilityId: row.id } });
    }
    console.log(`${a.email} | +50%: ${a.watchedOver50} | ${a.firstName} ${a.lastName}`);
  }
  console.log('Listo. Usa estos correos en /certificado/asistencia');
} finally {
  await prisma.$disconnect();
}
