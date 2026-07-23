import 'dotenv/config';
import { createWriteStream } from 'fs';
import PDFDocument from 'pdfkit';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const today = new Date().toISOString().slice(0, 10);
const OUT = `C:/Users/reasd/Downloads/Reporte_Certificado_EnVivo_y_Examen_${today}.pdf`;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const C = {
  primary: '#0f4c81',
  accent: '#1a6bb5',
  green: '#22c55e',
  red: '#ef4444',
  purple: '#7c3aed',
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

try {
  const generatedAt = new Date().toLocaleString('es-CL');

  const rows = await prisma.attendanceEligibility.findMany({
    include: {
      certificates: { orderBy: { issuedAt: 'asc' } },
      examAttempts: { orderBy: { submittedAt: 'desc' } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const real = rows.filter((r) => !isTest(r.email));

  const normalized = real.map((r) => {
    const liveCert = r.certificates.find((c) => c.type === 'LIVE_VIEWING') ?? null;
    const examCert = r.certificates.find((c) => c.type === 'EXAM') ?? null;
    const lastAttempt = r.examAttempts[0] ?? null;
    const attempted = !!lastAttempt;
    const passed = r.examAttempts.some((a) => a.passed);
    return {
      nombre: `${r.firstName} ${r.lastName}`.trim(),
      email: r.email,
      mas50: r.watchedOver50,
      live: !!liveCert,
      liveAt: liveCert?.issuedAt ?? null,
      examAttempted: attempted,
      examPassed: passed,
      lastExamAt: lastAttempt?.submittedAt ?? null,
      examCert: !!examCert,
      examCertAt: examCert?.issuedAt ?? null,
    };
  });

  const total = normalized.length;
  const eligible = normalized.filter((r) => r.mas50).length;
  const liveClaimed = normalized.filter((r) => r.live).length;
  const examAttempted = normalized.filter((r) => r.examAttempted).length;
  const examPassed = normalized.filter((r) => r.examPassed).length;
  const examCert = normalized.filter((r) => r.examCert).length;
  const bothLiveAndExam = normalized.filter((r) => r.live && r.examAttempted).length;

  const liveList = normalized
    .filter((r) => r.live)
    .sort((a, b) => (b.liveAt ?? 0) - (a.liveAt ?? 0));

  const examList = normalized
    .filter((r) => r.examAttempted)
    .sort((a, b) => (b.lastExamAt ?? 0) - (a.lastExamAt ?? 0));

  const certsByDay = {};
  for (const r of normalized) {
    if (!r.liveAt) continue;
    const d = r.liveAt.toISOString().slice(0, 10);
    certsByDay[d] = (certsByDay[d] || 0) + 1;
  }
  const certDays = Object.keys(certsByDay).sort();
  const certDayLabels = certDays.map((d) => d.slice(5));
  const certDayValues = certDays.map((d) => certsByDay[d]);

  const attemptsByDay = {};
  for (const r of examList) {
    const d = r.lastExamAt.toISOString().slice(0, 10);
    attemptsByDay[d] = (attemptsByDay[d] || 0) + 1;
  }
  const attemptDays = Object.keys(attemptsByDay).sort();
  const attemptDayLabels = attemptDays.map((d) => d.slice(5));
  const attemptDayValues = attemptDays.map((d) => attemptsByDay[d]);

  const [chartStatus, chartLiveByDay, chartExamByDay] = await Promise.all([
    chartUrl({
      type: 'bar',
      data: {
        labels: ['Total', 'Cumplen 50%', 'Cert. en vivo', 'Hicieron examen', 'Aprobaron examen', 'Cert. examen'],
        datasets: [
          {
            label: 'Personas',
            data: [total, eligible, liveClaimed, examAttempted, examPassed, examCert],
            backgroundColor: ['#cbd5e1', '#1a6bb5', '#22c55e', '#7c3aed', '#0f4c81', '#f97316'],
          },
        ],
      },
      options: { plugins: { legend: { display: false }, title: { display: true, text: 'Estado general' } }, scales: { y: { beginAtZero: true } } },
    }),
    chartUrl({
      type: 'bar',
      data: { labels: certDayLabels, datasets: [{ label: 'Certificados en vivo', data: certDayValues, backgroundColor: '#22c55e' }] },
      options: { plugins: { legend: { display: false }, title: { display: true, text: 'Certificados en vivo por día' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    }),
    chartUrl({
      type: 'bar',
      data: { labels: attemptDayLabels, datasets: [{ label: 'Intentos de examen', data: attemptDayValues, backgroundColor: '#7c3aed' }] },
      options: { plugins: { legend: { display: false }, title: { display: true, text: 'Examen: intentos por día' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    }),
  ]);

  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const stream = createWriteStream(OUT);
  doc.pipe(stream);

  drawHeader(doc, 'III Jornadas Regionales SCAI', 'Certificado en vivo y examen — Reporte', generatedAt);

  let y = 105;
  const cw = (doc.page.width - 100) / 4;
  drawCard(doc, 40, y, cw, 64, 'Asistentes reales', total, '');
  drawCard(doc, 40 + cw + 6, y, cw, 64, 'Cert. en vivo', liveClaimed, `${eligible} elegibles (≥50%)`);
  drawCard(doc, 40 + (cw + 6) * 2, y, cw, 64, 'Hicieron examen', examAttempted, `${examPassed} aprobaron`);
  drawCard(doc, 40 + (cw + 6) * 3, y, cw, 64, 'Live + examen', bothLiveAndExam, '');

  y += 74;
  doc.image(chartStatus, 40, y, { width: doc.page.width - 80 });
  y += 205;
  const hw = (doc.page.width - 90) / 2;
  doc.image(chartLiveByDay, 40, y, { width: hw });
  doc.image(chartExamByDay, 50 + hw, y, { width: hw });

  doc.addPage();
  drawHeader(doc, 'Certificado en vivo (canjeado)', `${liveList.length} personas`, generatedAt);
  y = 105;
  const liveCols = [
    { label: '#', w: 14 },
    { label: 'Nombre', w: 110 },
    { label: 'Correo', w: 160 },
    { label: '≥50%', w: 26 },
    { label: 'Fecha canje', w: 90 },
  ];
  y = drawTableHeader(doc, y, liveCols);
  doc.font('Helvetica').fontSize(7);
  liveList.forEach((r, i) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      drawHeader(doc, 'Certificado en vivo (cont.)', '', generatedAt);
      y = 105;
      y = drawTableHeader(doc, y, liveCols);
      doc.font('Helvetica').fontSize(7);
    }
    if (i % 2 === 0) doc.rect(40, y - 2, doc.page.width - 80, 16).fill('#fafbfc');
    let x = 44;
    const cells = [
      String(i + 1),
      trunc(r.nombre, 34),
      trunc(r.email, 48),
      r.mas50 ? 'Sí' : 'No',
      r.liveAt ? fmtDate(r.liveAt) : '—',
    ];
    for (let j = 0; j < liveCols.length; j++) {
      if (j === 2) doc.fillColor(C.gray).font('Helvetica');
      else if (j === 4) doc.fillColor(C.accent).font('Helvetica-Bold');
      else doc.fillColor(C.text).font('Helvetica');
      doc.text(cells[j], x, y, { width: liveCols[j].w, lineBreak: false });
      x += liveCols[j].w;
    }
    y += 16;
  });

  doc.addPage();
  drawHeader(doc, 'Examen (personas que lo hicieron)', `${examList.length} personas`, generatedAt);
  y = 105;
  const examCols = [
    { label: '#', w: 14 },
    { label: 'Nombre', w: 98 },
    { label: 'Correo', w: 146 },
    { label: 'Aprobó', w: 34 },
    { label: 'Cert. examen', w: 50 },
    { label: 'Último intento', w: 106 },
  ];
  y = drawTableHeader(doc, y, examCols);
  doc.font('Helvetica').fontSize(7);
  examList.forEach((r, i) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      drawHeader(doc, 'Examen (cont.)', '', generatedAt);
      y = 105;
      y = drawTableHeader(doc, y, examCols);
      doc.font('Helvetica').fontSize(7);
    }
    if (i % 2 === 0) doc.rect(40, y - 2, doc.page.width - 80, 16).fill('#fafbfc');
    if (!r.examPassed) doc.rect(40, y - 2, doc.page.width - 80, 16).fill('#fef2f2');
    let x = 44;
    const cells = [
      String(i + 1),
      trunc(r.nombre, 30),
      trunc(r.email, 44),
      r.examPassed ? 'Sí' : 'No',
      r.examCert ? 'Sí' : '—',
      r.lastExamAt ? fmtDate(r.lastExamAt) : '—',
    ];
    for (let j = 0; j < examCols.length; j++) {
      if (j === 3) doc.fillColor(r.examPassed ? '#166534' : '#991b1b').font('Helvetica-Bold');
      else if (j === 4 && r.examCert) doc.fillColor(C.purple).font('Helvetica-Bold');
      else doc.fillColor(C.text).font('Helvetica');
      doc.text(cells[j], x, y, { width: examCols[j].w, lineBreak: false });
      x += examCols[j].w;
    }
    y += 16;
  });

  addFooter(doc);
  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  console.log(`PDF: ${OUT}`);
  console.log(`Vivo: ${liveList.length} | Examen: ${examList.length} | Total reales: ${total}`);
} finally {
  await prisma.$disconnect();
}

