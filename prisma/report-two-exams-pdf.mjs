import 'dotenv/config';
import { createWriteStream } from 'fs';
import PDFDocument from 'pdfkit';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const today = new Date().toISOString().slice(0, 10);
const OUT_ATT = `C:/Users/reasd/Downloads/Reporte_Examen_Asistencia_${today}.pdf`;
const OUT_COURSE = `C:/Users/reasd/Downloads/Reporte_Examen_Curso_${today}.pdf`;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const C = {
  primary: '#0f4c81',
  green: '#22c55e',
  red: '#ef4444',
  gray: '#64748b',
  light: '#f1f5f9',
  text: '#1e293b',
};

function isTest(email) {
  return email.includes('@test-scai.cl');
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function trunc(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

async function chartUrl(config) {
  const c = encodeURIComponent(JSON.stringify(config));
  const url = `https://quickchart.io/chart?width=520&height=300&backgroundColor=white&c=${c}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('chart fetch failed');
  return Buffer.from(await res.arrayBuffer());
}

function drawHeader(doc, title, subtitle, generatedAt) {
  doc.rect(0, 0, doc.page.width, 92).fill(C.primary);
  doc.fillColor('#ffffff')
    .fontSize(18)
    .font('Helvetica-Bold')
    .text(title, 40, 22, { width: doc.page.width - 80 });
  doc.fontSize(10).font('Helvetica').text(subtitle, 40, 46, { width: doc.page.width - 80 });
  doc.fontSize(8).fillColor('#bfdbfe').text(`Generado: ${generatedAt} · Solo cuentas reales`, 40, 68);
  doc.fillColor(C.text);
}

function drawCard(doc, x, y, w, h, label, value, sub) {
  doc.roundedRect(x, y, w, h, 8).fillAndStroke('#ffffff', '#e2e8f0');
  doc.fillColor(C.gray).fontSize(8).font('Helvetica').text(label.toUpperCase(), x + 12, y + 10, { width: w - 24 });
  doc.fillColor(C.primary).fontSize(22).font('Helvetica-Bold').text(String(value), x + 12, y + 26);
  if (sub) doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(sub, x + 12, y + 52, { width: w - 24 });
}

function drawTableHeader(doc, y, cols) {
  doc.rect(40, y, doc.page.width - 80, 18).fill(C.light);
  let x = 44;
  doc.fillColor(C.gray).fontSize(7).font('Helvetica-Bold');
  for (const col of cols) {
    doc.text(col.label, x, y + 5, { width: col.w, lineBreak: false });
    x += col.w;
  }
  return y + 20;
}

function addFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text(`Tauren Pro · III Jornadas Regionales SCAI · Página ${i + 1} de ${pages.count}`, 40, doc.page.height - 26, {
        width: doc.page.width - 80,
        align: 'center',
      });
  }
}

async function renderExamReport({
  outPath,
  title,
  subtitle,
  totalPopulation,
  totalQuestions,
  attempts,
}) {
  const generatedAt = new Date().toLocaleString('es-CL');

  const passed = attempts.filter((a) => a.passed);
  const failed = attempts.filter((a) => !a.passed);
  const notAttempted = Math.max(0, totalPopulation - attempts.length);

  const byDay = {};
  for (const a of attempts) {
    const d = a.submittedAt.toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
  }
  const dayKeys = Object.keys(byDay).sort();
  const dayLabels = dayKeys.map((d) => d.slice(5));
  const dayValues = dayKeys.map((d) => byDay[d]);

  const correctDist = {};
  for (const a of passed) {
    const correctas = totalQuestions ? Math.round((a.score / 100) * totalQuestions) : 0;
    const k = `${correctas}/${totalQuestions}`;
    correctDist[k] = (correctDist[k] || 0) + 1;
  }
  const correctLabels = Object.keys(correctDist).sort((a, b) => parseInt(b) - parseInt(a));
  const correctValues = correctLabels.map((k) => correctDist[k]);

  const scoreBuckets = { '0-49': 0, '50-59': 0, '60-74': 0, '75-87': 0, '88-100': 0 };
  for (const a of attempts) {
    const s = a.score;
    if (s < 50) scoreBuckets['0-49']++;
    else if (s < 60) scoreBuckets['50-59']++;
    else if (s < 75) scoreBuckets['60-74']++;
    else if (s < 88) scoreBuckets['75-87']++;
    else scoreBuckets['88-100']++;
  }

  const [chartResults, chartDays, chartScores, chartCorrect] = await Promise.all([
    chartUrl({
      type: 'doughnut',
      data: {
        labels: ['Aprobaron', 'Reprobaron', 'Sin intentar'],
        datasets: [{ data: [passed.length, failed.length, notAttempted], backgroundColor: ['#22c55e', '#ef4444', '#cbd5e1'] }],
      },
      options: { plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Resultados' } } },
    }),
    chartUrl({
      type: 'bar',
      data: { labels: dayLabels, datasets: [{ label: 'Intentos', data: dayValues, backgroundColor: '#1a6bb5' }] },
      options: { plugins: { legend: { display: false }, title: { display: true, text: 'Intentos por día' } }, scales: { y: { beginAtZero: true } } },
    }),
    chartUrl({
      type: 'bar',
      data: { labels: Object.keys(scoreBuckets), datasets: [{ label: 'Participantes', data: Object.values(scoreBuckets), backgroundColor: '#0f4c81' }] },
      options: { plugins: { legend: { display: false }, title: { display: true, text: 'Distribución de score %' } }, scales: { y: { beginAtZero: true } } },
    }),
    chartUrl({
      type: 'bar',
      data: { labels: correctLabels, datasets: [{ label: 'Aprobaron', data: correctValues, backgroundColor: '#22c55e' }] },
      options: {
        plugins: { legend: { display: false }, title: { display: true, text: `Correctas (aprobaron) · ${totalQuestions} preguntas` } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    }),
  ]);

  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const stream = createWriteStream(outPath);
  doc.pipe(stream);

  drawHeader(doc, title, subtitle, generatedAt);

  let y = 105;
  const cw = (doc.page.width - 100) / 4;
  drawCard(doc, 40, y, cw, 64, 'Total', totalPopulation, 'Cuentas reales');
  drawCard(doc, 40 + cw + 6, y, cw, 64, 'Intentaron', attempts.length, `${notAttempted} pendientes`);
  drawCard(doc, 40 + (cw + 6) * 2, y, cw, 64, 'Aprobaron', passed.length, `${failed.length} reprobaron`);
  drawCard(doc, 40 + (cw + 6) * 3, y, cw, 64, 'Preguntas', totalQuestions, '');

  y += 74;
  const hw = (doc.page.width - 90) / 2;
  doc.image(chartResults, 40, y, { width: hw });
  doc.image(chartDays, 50 + hw, y, { width: hw });
  y += 190;
  doc.image(chartScores, 40, y, { width: hw });
  doc.image(chartCorrect, 50 + hw, y, { width: hw });

  doc.addPage();
  drawHeader(doc, 'Detalle de intentos', `${attempts.length} intentos (más recientes primero)`, generatedAt);

  const cols = [
    { label: '#', w: 14 },
    { label: 'Nombre', w: 86 },
    { label: 'Correo', w: 120 },
    { label: 'Result.', w: 40 },
    { label: 'Score', w: 30 },
    { label: 'Correctas', w: 44 },
    { label: 'Fecha', w: 84 },
  ];
  y = 105;
  y = drawTableHeader(doc, y, cols);
  doc.font('Helvetica').fontSize(7);

  attempts
    .slice()
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .forEach((a, i) => {
      if (y > doc.page.height - 60) {
        doc.addPage();
        drawHeader(doc, 'Detalle de intentos (cont.)', '', generatedAt);
        y = 105;
        y = drawTableHeader(doc, y, cols);
        doc.font('Helvetica').fontSize(7);
      }
      if (i % 2 === 0) doc.rect(40, y - 2, doc.page.width - 80, 16).fill('#fafbfc');
      if (!a.passed) doc.rect(40, y - 2, doc.page.width - 80, 16).fill('#fef2f2');

      const correctas = totalQuestions ? Math.round((a.score / 100) * totalQuestions) : 0;
      let x = 44;
      const cells = [
        String(i + 1),
        trunc(a.nombre, 26),
        trunc(a.email, 36),
        a.passed ? 'Aprobó' : 'Reprobó',
        `${a.score}%`,
        `${correctas}/${totalQuestions}`,
        fmtDate(a.submittedAt),
      ];
      for (let j = 0; j < cols.length; j++) {
        if (j === 3) doc.fillColor(a.passed ? '#166534' : '#991b1b').font('Helvetica-Bold');
        else if (j === 4) doc.fillColor(C.primary).font('Helvetica-Bold');
        else doc.fillColor(C.text).font('Helvetica');
        doc.text(cells[j], x, y, { width: cols[j].w, lineBreak: false });
        x += cols[j].w;
      }
      y += 16;
    });

  addFooter(doc);
  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

try {
  const published = await prisma.exam.findMany({
    where: { published: true },
    include: { _count: { select: { questions: true, attempts: true, attendanceExamAttempts: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const attendanceExam = published.find((e) => e._count.attendanceExamAttempts > 0) ?? published[0];
  const courseExam = published.find((e) => e._count.attempts > 0) ?? published.find((e) => e._count.attendanceExamAttempts === 0) ?? published[0];

  const attAttemptsRaw = await prisma.attendanceExamAttempt.findMany({
    where: { examId: attendanceExam.id },
    include: { eligibility: { select: { email: true, firstName: true, lastName: true } } },
    orderBy: { submittedAt: 'desc' },
  });

  const attAttempts = attAttemptsRaw
    .filter((a) => !isTest(a.eligibility.email))
    .map((a) => ({
      nombre: `${a.eligibility.firstName} ${a.eligibility.lastName}`.trim(),
      email: a.eligibility.email,
      score: a.score,
      passed: a.passed,
      submittedAt: a.submittedAt,
    }));

  const courseAttemptsRaw = await prisma.examAttempt.findMany({
    where: { examId: courseExam.id },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
    orderBy: { submittedAt: 'desc' },
  });

  const courseAttempts = courseAttemptsRaw
    .filter((a) => !isTest(a.user.email))
    .map((a) => ({
      nombre: `${a.user.firstName} ${a.user.lastName}`.trim(),
      email: a.user.email,
      score: a.score,
      passed: a.passed,
      submittedAt: a.submittedAt,
    }));

  const realAttendancePopulation = await prisma.attendanceEligibility.count({
    where: { NOT: { email: { contains: '@test-scai.cl' } } },
  });

  const realUsersPopulation = await prisma.user.count({
    where: { NOT: { email: { contains: '@test-scai.cl' } } },
  });

  await renderExamReport({
    outPath: OUT_ATT,
    title: 'Examen de Asistencia (Evento en vivo)',
    subtitle: attendanceExam.title,
    totalPopulation: realAttendancePopulation,
    totalQuestions: attendanceExam._count.questions,
    attempts: attAttempts,
  });

  await renderExamReport({
    outPath: OUT_COURSE,
    title: 'Examen del Curso (Login)',
    subtitle: courseExam.title,
    totalPopulation: realUsersPopulation,
    totalQuestions: courseExam._count.questions,
    attempts: courseAttempts,
  });

  console.log(`PDF asistencia: ${OUT_ATT}`);
  console.log(`PDF curso: ${OUT_COURSE}`);
} finally {
  await prisma.$disconnect();
}

