import 'dotenv/config';
import { createWriteStream } from 'fs';
import PDFDocument from 'pdfkit';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const today = new Date().toISOString().slice(0, 10);
const OUT = `C:/Users/reasd/Downloads/Reporte_Examen_SCAI_${today}.pdf`;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const C = {
  primary: '#0f4c81',
  accent: '#1a6bb5',
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
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
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

function drawCard(doc, x, y, w, h, label, value, sub) {
  doc.roundedRect(x, y, w, h, 8).fillAndStroke('#ffffff', '#e2e8f0');
  doc.fillColor(C.gray).fontSize(8).text(label.toUpperCase(), x + 12, y + 12, { width: w - 24 });
  doc.fillColor(C.primary).fontSize(22).font('Helvetica-Bold').text(String(value), x + 12, y + 28);
  if (sub) doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(sub, x + 12, y + 54, { width: w - 24 });
}

function drawHeader(doc, title, subtitle, generatedAt) {
  doc.rect(0, 0, doc.page.width, 100).fill(C.primary);
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
    .text(title, 40, 28, { width: doc.page.width - 80 });
  doc.fontSize(10).font('Helvetica').text(subtitle, 40, 54, { width: doc.page.width - 80 });
  doc.fontSize(8).fillColor('#bfdbfe').text(`Generado: ${generatedAt} · Solo cuentas reales`, 40, 78);
  doc.fillColor(C.text);
}

function drawTableHeader(doc, y, cols) {
  doc.rect(40, y, doc.page.width - 80, 20).fill(C.light);
  let x = 44;
  doc.fillColor(C.gray).fontSize(7).font('Helvetica-Bold');
  for (const col of cols) {
    doc.text(col.label, x, y + 6, { width: col.w, lineBreak: false });
    x += col.w;
  }
  return y + 22;
}

function addFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
      .text(`Tauren Pro · III Jornadas Regionales SCAI · Página ${i + 1} de ${pages.count}`, 40, doc.page.height - 30, {
        width: doc.page.width - 80, align: 'center',
      });
  }
}

try {
  const all = await prisma.attendanceEligibility.findMany({
    include: {
      certificates: true,
      examAttempts: { orderBy: { submittedAt: 'desc' } },
    },
  });

  const real = all.filter((a) => !isTest(a.email));
  const realExam = real.filter((a) => a.examAttempts.length > 0);
  const realPassed = realExam.filter((a) => a.examAttempts.some((e) => e.passed));
  const realFailed = realExam.filter((a) => !a.examAttempts.some((e) => e.passed));
  const notAttempted = real.filter((a) => a.examAttempts.length === 0);
  const conMas50 = real.filter((a) => a.watchedOver50).length;
  const liveCerts = real.filter((a) => a.certificates.some((c) => c.type === 'LIVE_VIEWING')).length;
  const examCerts = real.filter((a) => a.certificates.some((c) => c.type === 'EXAM')).length;

  const exam = await prisma.exam.findFirst({
    where: { published: true },
    include: { questions: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  const totalQ = exam?.questions.length ?? 0;
  const questionMap = new Map((exam?.questions ?? []).map((q, i) => [q.id, { ...q, num: i + 1 }]));

  const wrongByQuestion = new Map();
  let attemptsWithAnswers = 0;
  let totalWrongAnswers = 0;

  for (const a of realExam) {
    const attempt = a.examAttempts[0];
    const answers = attempt.answers;
    if (!Array.isArray(answers) || answers.length === 0) continue;
    attemptsWithAnswers++;
    for (const ans of answers) {
      if (!ans.correct) {
        wrongByQuestion.set(ans.questionId, (wrongByQuestion.get(ans.questionId) || 0) + 1);
        totalWrongAnswers++;
      }
    }
  }

  const wrongStats = [...wrongByQuestion.entries()]
    .map(([questionId, count]) => {
      const q = questionMap.get(questionId);
      return {
        questionId,
        num: q?.num ?? '?',
        text: q?.text ?? 'Pregunta desconocida',
        count,
        pct: attemptsWithAnswers ? Math.round((count / attemptsWithAnswers) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  const byDay = {};
  for (const a of realExam) {
    const d = a.examAttempts[0].submittedAt.toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
  }
  const dayLabels = Object.keys(byDay).sort().map((d) => d.slice(5));
  const dayValues = Object.keys(byDay).sort().map((d) => byDay[d]);

  const scoreBuckets = { '75-80': 0, '81-87': 0, '88-93': 0, '94-100': 0 };
  for (const a of realPassed) {
    const s = a.examAttempts.find((e) => e.passed)?.score ?? 0;
    if (s < 81) scoreBuckets['75-80']++;
    else if (s < 88) scoreBuckets['81-87']++;
    else if (s < 94) scoreBuckets['88-93']++;
    else scoreBuckets['94-100']++;
  }

  const correctDist = {};
  const participants = realExam.map((a) => {
    const attempt = a.examAttempts[0];
    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    const correctFromAnswers = answers.length ? answers.filter((x) => x.correct).length : null;
    const wrongFromAnswers = answers.length ? answers.filter((x) => !x.correct).length : null;
    const correctas = correctFromAnswers ?? (totalQ ? Math.round((attempt.score / 100) * totalQ) : 0);
    const incorrectas = wrongFromAnswers ?? (totalQ ? totalQ - correctas : 0);
    if (attempt.passed) {
      const k = `${correctas}/${totalQ}`;
      correctDist[k] = (correctDist[k] || 0) + 1;
    }
    return {
      nombre: `${a.firstName} ${a.lastName}`.trim(),
      email: a.email,
      score: attempt.score,
      passed: attempt.passed,
      correctas,
      incorrectas,
      fecha: attempt.submittedAt,
      mas50: a.watchedOver50,
      certLive: a.certificates.some((c) => c.type === 'LIVE_VIEWING'),
      certExam: a.certificates.some((c) => c.type === 'EXAM'),
    };
  }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const generatedAt = new Date().toLocaleString('es-CL');
  const tasa = realExam.length ? Math.round((realPassed.length / realExam.length) * 100) : 0;

  const chartPromises = [
    chartUrl({
      type: 'doughnut',
      data: {
        labels: ['Aprobaron', 'Reprobaron', 'Sin intentar'],
        datasets: [{ data: [realPassed.length, realFailed.length, notAttempted.length], backgroundColor: ['#22c55e', '#ef4444', '#cbd5e1'] }],
      },
      options: { plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Resultados (cuentas reales)' } } },
    }),
    chartUrl({
      type: 'bar',
      data: {
        labels: dayLabels,
        datasets: [{ label: 'Intentos', data: dayValues, backgroundColor: '#1a6bb5' }],
      },
      options: { plugins: { legend: { display: false }, title: { display: true, text: 'Intentos por día' } }, scales: { y: { beginAtZero: true } } },
    }),
    chartUrl({
      type: 'bar',
      data: {
        labels: Object.keys(scoreBuckets),
        datasets: [{ label: 'Aprobados', data: Object.values(scoreBuckets), backgroundColor: ['#fbbf24', '#f97316', '#3b82f6', '#22c55e'] }],
      },
      options: { plugins: { legend: { display: false }, title: { display: true, text: 'Distribución de notas %' } }, scales: { y: { beginAtZero: true } } },
    }),
    chartUrl({
      type: 'bar',
      data: {
        labels: Object.keys(correctDist).sort((a, b) => parseInt(b) - parseInt(a)),
        datasets: [{ label: 'Aprobaron', data: Object.keys(correctDist).sort((a, b) => parseInt(b) - parseInt(a)).map((k) => correctDist[k]), backgroundColor: '#0f4c81' }],
      },
      options: { plugins: { legend: { display: false }, title: { display: true, text: `Respuestas correctas (${totalQ} preguntas)` } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    }),
  ];

  if (wrongStats.length > 0) {
    const top = wrongStats.slice(0, 12);
    chartPromises.push(
      chartUrl({
        type: 'bar',
        data: {
          labels: top.map((w) => `P${w.num}`),
          datasets: [{ label: 'Personas que fallaron', data: top.map((w) => w.count), backgroundColor: '#ef4444' }],
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false }, title: { display: true, text: 'Preguntas con más errores' } },
          scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
        },
      }),
    );
  }

  const charts = await Promise.all(chartPromises);
  const [chartResults, chartDays, chartScores, chartCorrect, chartWrong] = charts;

  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const stream = createWriteStream(OUT);
  doc.pipe(stream);

  drawHeader(doc, 'III Jornadas Regionales SCAI', 'Reporte de Examen — Sociedad Chilena de Alergia e Inmunología', generatedAt);

  let y = 115;
  const cw = (doc.page.width - 100) / 4;
  drawCard(doc, 40, y, cw, 68, 'Total asistentes', real.length, 'Solo cuentas reales');
  drawCard(doc, 40 + cw + 6, y, cw, 68, 'Hicieron examen', realExam.length, `${notAttempted.length} pendientes`);
  drawCard(doc, 40 + (cw + 6) * 2, y, cw, 68, 'Aprobaron', realPassed.length, `${realFailed.length} reprobaron`);
  drawCard(doc, 40 + (cw + 6) * 3, y, cw, 68, 'Preguntas examen', totalQ, `${attemptsWithAnswers} con detalle por pregunta`);

  y += 78;
  drawCard(doc, 40, y, cw, 58, 'Cumplen 50%', conMas50, '');
  drawCard(doc, 40 + cw + 6, y, cw, 58, 'Cert. en vivo', liveCerts, '');
  drawCard(doc, 40 + (cw + 6) * 2, y, cw, 58, 'Cert. examen', examCerts, '');
  drawCard(doc, 40 + (cw + 6) * 3, y, cw, 58, 'Tasa aprobación', `${tasa}%`, '');

  y += 70;
  const hw = (doc.page.width - 90) / 2;
  doc.image(chartResults, 40, y, { width: hw });
  doc.image(chartDays, 50 + hw, y, { width: hw });
  y += 195;
  doc.image(chartScores, 40, y, { width: hw });
  doc.image(chartCorrect, 50 + hw, y, { width: hw });

  doc.addPage();
  drawHeader(doc, 'Análisis de respuestas', `Examen de ${totalQ} preguntas · Mínimo para aprobar: ${Math.ceil(totalQ * (4 / 6))} correctas`, generatedAt);
  y = 115;

  if (chartWrong) {
    doc.image(chartWrong, 40, y, { width: doc.page.width - 80 });
    y += 210;
  } else {
    doc.roundedRect(40, y, doc.page.width - 80, 80, 8).fillAndStroke('#fff7ed', '#fed7aa');
    doc.fillColor('#9a3412').fontSize(9).font('Helvetica')
      .text('Sin detalle de qué pregunta falló cada persona en intentos anteriores. Los nuevos intentos quedarán registrados automáticamente.', 50, y + 28, { width: doc.page.width - 100, align: 'center' });
    y += 95;
  }

  doc.fillColor(C.text).fontSize(11).font('Helvetica-Bold').text('Distribución de respuestas correctas (aprobados)', 40, y);
  y += 18;
  doc.font('Helvetica').fontSize(9);
  for (const [k, v] of Object.entries(correctDist).sort((a, b) => parseInt(b[0]) - parseInt(a[0]))) {
    doc.text(`• ${k}: ${v} persona${v > 1 ? 's' : ''}`, 50, y);
    y += 14;
  }

  doc.addPage();
  drawHeader(doc, 'Errores por pregunta', `Basado en ${attemptsWithAnswers} de ${realExam.length} intentos con respuestas guardadas`, generatedAt);

  y = 115;
  if (wrongStats.length === 0) {
    doc.fillColor(C.gray).fontSize(10).font('Helvetica')
      .text('No hay respuestas detalladas guardadas aún. A partir de ahora cada intento registra qué preguntas falló cada participante.', 40, y, { width: doc.page.width - 80 });
  } else {
    const qCols = [
      { label: 'Pregunta', w: 28 },
      { label: 'Enunciado', w: 280 },
      { label: 'Fallaron', w: 45 },
      { label: '% intentos', w: 55 },
    ];
    y = drawTableHeader(doc, y, qCols);
    doc.font('Helvetica').fontSize(7);
    for (const w of wrongStats) {
      if (y > doc.page.height - 60) {
        doc.addPage();
        drawHeader(doc, 'Errores por pregunta (cont.)', '', generatedAt);
        y = 115;
        y = drawTableHeader(doc, y, qCols);
        doc.font('Helvetica').fontSize(7);
      }
      let x = 44;
      doc.fillColor(C.primary).font('Helvetica-Bold').text(`P${w.num}`, x, y, { width: qCols[0].w });
      x += qCols[0].w;
      doc.fillColor(C.text).font('Helvetica').text(trunc(w.text, 95), x, y, { width: qCols[1].w });
      x += qCols[1].w;
      doc.fillColor(C.red).font('Helvetica-Bold').text(String(w.count), x, y, { width: qCols[2].w });
      x += qCols[2].w;
      doc.fillColor(C.gray).font('Helvetica').text(`${w.pct}%`, x, y, { width: qCols[3].w });
      y += 22;
    }
  }

  doc.addPage();
  drawHeader(doc, 'Detalle de participantes', `${realExam.length} asistentes reales hicieron el examen`, generatedAt);

  const cols = [
    { label: '#', w: 14 },
    { label: 'Nombre', w: 72 },
    { label: 'Correo', w: 98 },
    { label: 'Result.', w: 34 },
    { label: 'Nota', w: 24 },
    { label: 'Buenas', w: 30 },
    { label: 'Malas', w: 26 },
    { label: '50%', w: 18 },
    { label: 'Vivo', w: 18 },
    { label: 'Examen', w: 24 },
    { label: 'Fecha', w: 66 },
  ];

  y = 115;
  y = drawTableHeader(doc, y, cols);
  doc.font('Helvetica').fontSize(7);

  participants.forEach((p, i) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      drawHeader(doc, 'Detalle de participantes (cont.)', '', generatedAt);
      y = 115;
      y = drawTableHeader(doc, y, cols);
      doc.font('Helvetica').fontSize(7);
    }
    if (i % 2 === 0) doc.rect(40, y - 2, doc.page.width - 80, 16).fill('#fafbfc');
    if (!p.passed) doc.rect(40, y - 2, doc.page.width - 80, 16).fill('#fef2f2');

    let x = 44;
    const cells = [
      String(i + 1),
      trunc(p.nombre, 22),
      trunc(p.email, 28),
      p.passed ? 'Aprobó' : 'Reprobó',
      `${p.score}%`,
      `${p.correctas}/${totalQ}`,
      p.incorrectas > 0 ? String(p.incorrectas) : '0',
      p.mas50 ? 'Sí' : 'No',
      p.certLive ? 'Sí' : '—',
      p.certExam ? 'Sí' : '—',
      fmtDate(p.fecha),
    ];
    for (let j = 0; j < cols.length; j++) {
      if (j === 3) doc.fillColor(p.passed ? '#166534' : '#991b1b').font('Helvetica-Bold');
      else if (j === 4) doc.fillColor(C.primary).font('Helvetica-Bold');
      else if (j === 5) doc.fillColor(C.green).font('Helvetica-Bold');
      else if (j === 6 && p.incorrectas > 0) doc.fillColor(C.red).font('Helvetica-Bold');
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

  console.log(`PDF generado: ${OUT}`);
  console.log(`Reales: ${real.length} | Examen: ${realExam.length} | Aprobaron: ${realPassed.length}`);
  console.log(`Intentos con respuestas: ${attemptsWithAnswers}/${realExam.length} | Errores totales: ${totalWrongAnswers}`);
  if (wrongStats.length) {
    console.log('Top 3 preguntas más falladas:');
    wrongStats.slice(0, 3).forEach((w) => console.log(`  P${w.num}: ${w.count} personas (${w.pct}%)`));
  }
} finally {
  await prisma.$disconnect();
}
