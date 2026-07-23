import 'dotenv/config';
import { createWriteStream } from 'fs';
import PDFDocument from 'pdfkit';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const today = new Date().toISOString().slice(0, 10);
const OUT = `C:/Users/reasd/Downloads/Reporte_Certificados_Asistencia_SCAI_${today}.pdf`;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const C = {
  primary: '#0f4c81',
  accent: '#1a6bb5',
  green: '#22c55e',
  orange: '#f97316',
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

function certStatus(a) {
  const live = a.certificates.some((c) => c.type === 'LIVE_VIEWING');
  const exam = a.certificates.some((c) => c.type === 'EXAM');
  if (live && exam) return 'Ambos';
  if (live) return 'Solo en vivo';
  if (exam) return 'Solo examen';
  if (a.watchedOver50) return 'Pendiente en vivo';
  return 'Sin certificado';
}

try {
  const all = await prisma.attendanceEligibility.findMany({
    include: {
      certificates: { orderBy: { issuedAt: 'asc' } },
      examAttempts: { orderBy: { submittedAt: 'desc' } },
    },
    orderBy: { lastName: 'asc' },
  });

  const real = all.filter((a) => !isTest(a.email));
  const conMas50 = real.filter((a) => a.watchedOver50);
  const sin50 = real.filter((a) => !a.watchedOver50);

  const withLive = real.filter((a) => a.certificates.some((c) => c.type === 'LIVE_VIEWING'));
  const withExam = real.filter((a) => a.certificates.some((c) => c.type === 'EXAM'));
  const withBoth = real.filter((a) =>
    a.certificates.some((c) => c.type === 'LIVE_VIEWING') &&
    a.certificates.some((c) => c.type === 'EXAM'),
  );
  const withAny = real.filter((a) => a.certificates.length > 0);
  const withNone = real.filter((a) => a.certificates.length === 0);

  const eligibleLivePending = conMas50.filter((a) => !a.certificates.some((c) => c.type === 'LIVE_VIEWING'));
  const passedExamNoCert = real.filter((a) =>
    a.examAttempts.some((e) => e.passed) && !a.certificates.some((c) => c.type === 'EXAM'),
  );

  const liveCerts = real.flatMap((a) =>
    a.certificates.filter((c) => c.type === 'LIVE_VIEWING').map((c) => ({ ...c, person: a })),
  );
  const examCerts = real.flatMap((a) =>
    a.certificates.filter((c) => c.type === 'EXAM').map((c) => ({ ...c, person: a })),
  );

  const certsByDay = {};
  for (const c of [...liveCerts, ...examCerts]) {
    const d = c.issuedAt.toISOString().slice(0, 10);
    if (!certsByDay[d]) certsByDay[d] = { live: 0, exam: 0 };
    if (c.type === 'LIVE_VIEWING') certsByDay[d].live++;
    else certsByDay[d].exam++;
  }
  const dayKeys = Object.keys(certsByDay).sort();
  const dayLabels = dayKeys.map((d) => d.slice(5));

  const statusCounts = {
    'Ambos certificados': withBoth.length,
    'Solo en vivo': withLive.filter((a) => !a.certificates.some((c) => c.type === 'EXAM')).length,
    'Solo examen': withExam.filter((a) => !a.certificates.some((c) => c.type === 'LIVE_VIEWING')).length,
    'Sin certificado': withNone.length,
  };

  const claimants = withAny.map((a) => {
    const liveC = a.certificates.find((c) => c.type === 'LIVE_VIEWING');
    const examC = a.certificates.find((c) => c.type === 'EXAM');
    return {
      nombre: `${a.firstName} ${a.lastName}`.trim(),
      email: a.email,
      mas50: a.watchedOver50,
      live: !!liveC,
      exam: !!examC,
      liveFecha: liveC?.issuedAt ?? null,
      examFecha: examC?.issuedAt ?? null,
      estado: certStatus(a),
    };
  }).sort((a, b) => {
    const da = Math.max(a.liveFecha ? +a.liveFecha : 0, a.examFecha ? +a.examFecha : 0);
    const db = Math.max(b.liveFecha ? +b.liveFecha : 0, b.examFecha ? +b.examFecha : 0);
    return db - da;
  });

  const generatedAt = new Date().toLocaleString('es-CL');
  const tasaCanjeLive = conMas50.length ? Math.round((withLive.length / conMas50.length) * 100) : 0;
  const tasaCanjeTotal = real.length ? Math.round((withAny.length / real.length) * 100) : 0;

  const [chartStatus, chartEligibility, chartByDay, chartTypes] = await Promise.all([
    chartUrl({
      type: 'doughnut',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: ['#0f4c81', '#2d8fd5', '#7c3aed', '#cbd5e1'],
        }],
      },
      options: { plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Estado de certificados' } } },
    }),
    chartUrl({
      type: 'bar',
      data: {
        labels: ['Cumplen 50%', 'No cumplen 50%'],
        datasets: [
          { label: 'Con cert. en vivo', data: [withLive.filter((a) => a.watchedOver50).length, withLive.filter((a) => !a.watchedOver50).length], backgroundColor: '#1a6bb5' },
          { label: 'Elegibles sin canjear', data: [eligibleLivePending.length, sin50.length], backgroundColor: '#f97316' },
        ],
      },
      options: {
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Elegibilidad vs certificado en vivo' } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 5 } } },
      },
    }),
    chartUrl({
      type: 'bar',
      data: {
        labels: dayLabels,
        datasets: [
          { label: 'Cert. en vivo', data: dayKeys.map((d) => certsByDay[d].live), backgroundColor: '#1a6bb5' },
          { label: 'Cert. examen', data: dayKeys.map((d) => certsByDay[d].exam), backgroundColor: '#7c3aed' },
        ],
      },
      options: {
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Certificados emitidos por día' } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    }),
    chartUrl({
      type: 'pie',
      data: {
        labels: ['Cert. en vivo', 'Cert. examen'],
        datasets: [{
          data: [liveCerts.length, examCerts.length],
          backgroundColor: ['#1a6bb5', '#7c3aed'],
        }],
      },
      options: { plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Total certificados emitidos' } } },
    }),
  ]);

  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const stream = createWriteStream(OUT);
  doc.pipe(stream);

  drawHeader(
    doc,
    'III Jornadas Regionales SCAI',
    'Reporte de Certificados de Asistencia — Evento en Vivo',
    generatedAt,
  );

  let y = 115;
  const cw = (doc.page.width - 100) / 4;
  drawCard(doc, 40, y, cw, 68, 'Total asistentes', real.length, 'Cuentas reales');
  drawCard(doc, 40 + cw + 6, y, cw, 68, 'Cumplen 50%', conMas50.length, `${sin50.length} no cumplen`);
  drawCard(doc, 40 + (cw + 6) * 2, y, cw, 68, 'Canjearon alguno', withAny.length, `${tasaCanjeTotal}% del total`);
  drawCard(doc, 40 + (cw + 6) * 3, y, cw, 68, 'Certificados emitidos', liveCerts.length + examCerts.length, `${withBoth.length} con ambos`);

  y += 78;
  drawCard(doc, 40, y, cw, 58, 'Cert. en vivo', liveCerts.length, `${tasaCanjeLive}% de elegibles`);
  drawCard(doc, 40 + cw + 6, y, cw, 58, 'Cert. examen', examCerts.length, '');
  drawCard(doc, 40 + (cw + 6) * 2, y, cw, 58, 'Pendiente en vivo', eligibleLivePending.length, 'Elegibles sin canjear');
  drawCard(doc, 40 + (cw + 6) * 3, y, cw, 58, 'Sin certificado', withNone.length, '');

  y += 70;
  const hw = (doc.page.width - 90) / 2;
  doc.image(chartStatus, 40, y, { width: hw });
  doc.image(chartTypes, 50 + hw, y, { width: hw });
  y += 195;
  doc.image(chartEligibility, 40, y, { width: hw });
  doc.image(chartByDay, 50 + hw, y, { width: hw });

  doc.addPage();
  drawHeader(doc, 'Resumen por tipo de certificado', 'Certificado en vivo (≥50%) y certificado por examen', generatedAt);
  y = 115;

  doc.fillColor(C.text).fontSize(11).font('Helvetica-Bold').text('Certificado de asistencia al evento en vivo', 40, y);
  y += 16;
  doc.font('Helvetica').fontSize(9);
  doc.text(`• Requisito: ver ≥50% del streaming en vivo`, 50, y); y += 14;
  doc.text(`• Elegibles: ${conMas50.length} asistentes`, 50, y); y += 14;
  doc.text(`• Canjearon: ${withLive.length} (${tasaCanjeLive}%)`, 50, y); y += 14;
  doc.text(`• Pendientes de canjear: ${eligibleLivePending.length}`, 50, y); y += 22;

  doc.font('Helvetica-Bold').fontSize(11).text('Certificado por examen del evento', 40, y);
  y += 16;
  doc.font('Helvetica').fontSize(9);
  doc.text(`• Requisito: aprobar el examen (nota ≥ 5.0)`, 50, y); y += 14;
  doc.text(`• Canjearon: ${withExam.length}`, 50, y); y += 14;
  doc.text(`• Con ambos certificados: ${withBoth.length}`, 50, y); y += 22;

  doc.font('Helvetica-Bold').fontSize(11).text('Distribución de estados', 40, y);
  y += 16;
  doc.font('Helvetica').fontSize(9);
  for (const [k, v] of Object.entries(statusCounts)) {
    doc.text(`• ${k}: ${v}`, 50, y);
    y += 14;
  }

  doc.addPage();
  drawHeader(doc, 'Personas que canjearon certificados', `${claimants.length} participantes`, generatedAt);

  const cols = [
    { label: '#', w: 14 },
    { label: 'Nombre', w: 78 },
    { label: 'Correo', w: 108 },
    { label: '≥50%', w: 22 },
    { label: 'En vivo', w: 28 },
    { label: 'Examen', w: 28 },
    { label: 'Estado', w: 58 },
    { label: 'Último canje', w: 68 },
  ];

  y = 115;
  y = drawTableHeader(doc, y, cols);
  doc.font('Helvetica').fontSize(7);

  claimants.forEach((p, i) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      drawHeader(doc, 'Canjes de certificados (cont.)', '', generatedAt);
      y = 115;
      y = drawTableHeader(doc, y, cols);
      doc.font('Helvetica').fontSize(7);
    }
    if (i % 2 === 0) doc.rect(40, y - 2, doc.page.width - 80, 16).fill('#fafbfc');

    const ultimo = p.examFecha && p.liveFecha
      ? (p.examFecha > p.liveFecha ? p.examFecha : p.liveFecha)
      : (p.examFecha || p.liveFecha);

    let x = 44;
    const cells = [
      String(i + 1),
      trunc(p.nombre, 22),
      trunc(p.email, 30),
      p.mas50 ? 'Sí' : 'No',
      p.live ? 'Sí' : '—',
      p.exam ? 'Sí' : '—',
      p.estado,
      ultimo ? fmtDate(ultimo) : '—',
    ];
    for (let j = 0; j < cols.length; j++) {
      if (j === 4 && p.live) doc.fillColor(C.accent).font('Helvetica-Bold');
      else if (j === 5 && p.exam) doc.fillColor(C.purple).font('Helvetica-Bold');
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
  console.log(`Asistentes: ${real.length} | Cert. en vivo: ${liveCerts.length} | Cert. examen: ${examCerts.length}`);
  console.log(`Ambos: ${withBoth.length} | Sin certificado: ${withNone.length} | Pendiente en vivo: ${eligibleLivePending.length}`);
} finally {
  await prisma.$disconnect();
}
