import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function isTest(e) {
  return e.includes('@test-scai.cl');
}

try {
  const exam = await prisma.exam.findFirst({
    where: { published: true },
    include: { _count: { select: { questions: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const totalQ = exam?._count.questions ?? 0;

  const attempts = await prisma.attendanceExamAttempt.findMany({
    where: { passed: true },
    include: { eligibility: { select: { email: true, firstName: true, lastName: true } } },
    orderBy: { submittedAt: 'desc' },
  });

  const real = attempts.filter((a) => !isTest(a.eligibility.email));

  const rows = real.map((a) => {
    const answers = Array.isArray(a.answers) ? a.answers : null;
    const correctFromAnswers = answers ? answers.filter((x) => x.correct).length : null;
    const wrongFromAnswers = answers ? answers.filter((x) => !x.correct).length : null;
    const correctFromScore = totalQ ? Math.round((a.score / 100) * totalQ) : null;
    return {
      nombre: `${a.eligibility.firstName} ${a.eligibility.lastName}`.trim(),
      email: a.eligibility.email,
      score: a.score,
      correctas: correctFromAnswers ?? correctFromScore,
      incorrectas: wrongFromAnswers ?? (totalQ && correctFromScore !== null ? totalQ - correctFromScore : null),
      tieneDetalle: !!answers,
      totalPreguntas: totalQ,
    };
  });

  const distribucion = {};
  for (const r of rows) {
    const k = `${r.correctas}/${r.totalPreguntas}`;
    distribucion[k] = (distribucion[k] || 0) + 1;
  }

  console.log(JSON.stringify({
    totalPreguntasExamen: totalQ,
    aprobaronReales: rows.length,
    conRespuestasGuardadas: rows.filter((r) => r.tieneDetalle).length,
    distribucionCorrectas: distribucion,
    participantes: rows,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
