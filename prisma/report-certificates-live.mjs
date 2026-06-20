import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const all = await prisma.attendanceEligibility.findMany({
    include: {
      certificates: { orderBy: { issuedAt: 'asc' } },
      examAttempts: { orderBy: { submittedAt: 'desc' }, include: { exam: { select: { title: true } } } },
    },
    orderBy: { email: 'asc' },
  });

  const withCerts = all.filter((a) => a.certificates.length > 0);
  const withExam = all.filter((a) => a.examAttempts.length > 0);
  const passedExam = all.filter((a) => a.examAttempts.some((e) => e.passed));
  const failedExam = all.filter((a) => a.examAttempts.length > 0 && !a.examAttempts.some((e) => e.passed));
  const liveCerts = all.flatMap((a) =>
    a.certificates
      .filter((c) => c.type === 'LIVE_VIEWING')
      .map((c) => ({ ...c, email: a.email, name: `${a.firstName} ${a.lastName}`, watchedOver50: a.watchedOver50 })),
  );
  const examCerts = all.flatMap((a) =>
    a.certificates
      .filter((c) => c.type === 'EXAM')
      .map((c) => ({ ...c, email: a.email, name: `${a.firstName} ${a.lastName}`, watchedOver50: a.watchedOver50 })),
  );

  console.log(JSON.stringify({
    resumen: {
      totalAsistentes: all.length,
      conMas50: all.filter((a) => a.watchedOver50).length,
      sin50: all.filter((a) => !a.watchedOver50).length,
      canjearonAlMenosUnCertificado: withCerts.length,
      certificadosLiveViewing: liveCerts.length,
      certificadosExamen: examCerts.length,
      totalCertificadosEmitidos: liveCerts.length + examCerts.length,
      intentaronExamen: withExam.length,
      aprobaronExamen: passedExam.length,
      reprobaronExamen: failedExam.length,
    },
    certificadosLiveViewing: liveCerts.map((c) => ({
      nombre: c.name,
      email: c.email,
      codigo: c.certificateCode,
      emitido: c.issuedAt,
      mas50: c.watchedOver50,
    })),
    certificadosExamen: examCerts.map((c) => ({
      nombre: c.name,
      email: c.email,
      codigo: c.certificateCode,
      emitido: c.issuedAt,
      mas50: c.watchedOver50,
    })),
    intentosExamen: withExam.map((a) => ({
      nombre: `${a.firstName} ${a.lastName}`,
      email: a.email,
      mas50: a.watchedOver50,
      intentos: a.examAttempts.map((e) => ({
        score: e.score,
        passed: e.passed,
        submittedAt: e.submittedAt,
        exam: e.exam.title,
      })),
      certificadoExamen: a.certificates.some((c) => c.type === 'EXAM'),
      certificadoLive: a.certificates.some((c) => c.type === 'LIVE_VIEWING'),
    })),
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
