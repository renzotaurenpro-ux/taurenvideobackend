import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Uso: node prisma/reset-attendance-user.mjs <email>');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const row = await prisma.attendanceEligibility.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { certificates: true, examAttempts: true },
  });

  if (!row) {
    console.log('NOT_FOUND');
    process.exit(0);
  }

  const deletedCerts = await prisma.attendanceCertificate.deleteMany({ where: { eligibilityId: row.id } });
  const deletedAttempts = await prisma.attendanceExamAttempt.deleteMany({ where: { eligibilityId: row.id } });

  console.log(JSON.stringify({
    email: row.email,
    nombre: `${row.firstName} ${row.lastName}`,
    watchedOver80: row.watchedOver80,
    certificadosEliminados: deletedCerts.count,
    intentosEliminados: deletedAttempts.count,
    puedeHacerExamen: true,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
