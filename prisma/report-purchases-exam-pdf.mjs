import { createRequire } from 'module';
import { readFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');
const { neon } = require('@neondatabase/serverless');

const envText = readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*"(.*)"\s*$/) || line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/\\n/g, '\n');
}

const sql = neon(env.DATABASE_URL);
const OUT = join(homedir(), 'Desktop', 'Reporte_Ventas_SCAI_2026-10-14.pdf');

const EXCLUDE = new Set([
  'tauren.proeventos@gmail.com',
  'taurenconsulting@gmail.com',
  'tauren.consulting.ads@gmail.com',
  'tauren.proservices@gmail.com',
  'francisco@taurenproeventos.cl',
  'franciscotricencio@gmail.com',
]);

function isInternal(email) {
  const e = String(email || '').toLowerCase().trim();
  return EXCLUDE.has(e) || e.includes('tauren');
}

const C = {
  primary: '#0b3d5c',
  accent: '#12B4C6',
  green: '#059669',
  red: '#dc2626',
  orange: '#ea580c',
  gray: '#64748b',
  soft: '#e8f4f7',
  light: '#f0f9fb',
  text: '#0f172a',
  white: '#ffffff',
  line: '#dbe7ee',
};

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function money(n) {
  return `$${Number(n).toLocaleString('es-CL')}`;
}

function trunc(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

async function chartBuf(config, w = 520, h = 260) {
  const c = encodeURIComponent(JSON.stringify(config));
  const url = `https://quickchart.io/chart?width=${w}&height=${h}&backgroundColor=white&devicePixelRatio=2&c=${c}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('chart fail');
  return Buffer.from(await res.arrayBuffer());
}

function drawCard(doc, x, y, w, h, label, value, sub, accent) {
  doc.roundedRect(x, y, w, h, 10).fillAndStroke(C.white, C.line);
  doc.roundedRect(x, y, 5, h, 2).fill(accent || C.accent);
  doc.fillColor(C.gray).fontSize(7.5).font('Helvetica').text(label.toUpperCase(), x + 16, y + 12, { width: w - 28 });
  doc.fillColor(C.primary).fontSize(20).font('Helvetica-Bold').text(String(value), x + 16, y + 28, { width: w - 28 });
  if (sub) doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica').text(sub, x + 16, y + 54, { width: w - 28 });
}

function sectionTitle(doc, y, title) {
  doc.fillColor(C.primary).fontSize(13).font('Helvetica-Bold').text(title, 40, y);
  doc.moveTo(40, y + 18).lineTo(doc.page.width - 40, y + 18).strokeColor(C.accent).lineWidth(1.5).stroke();
  return y + 28;
}

function ensureSpace(doc, y, need) {
  if (y > doc.page.height - need) {
    doc.addPage();
    return 40;
  }
  return y;
}

const nowRow = await sql`SELECT to_char(NOW() AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD HH24:MI:SS') AS ahora`;
const ahora = nowRow[0].ahora;

const purchasesRaw = await sql`
  SELECT u.email, u."firstName", u."lastName", u.city, u.rut, u."phoneNumber",
         u.workplace, u."medicalArea", p."amountClp", p."createdAt", u.id AS "userId"
  FROM purchases p
  JOIN users u ON u.id = p."userId"
  WHERE p.status = 'COMPLETED'
  ORDER BY p."createdAt" DESC
`;

const examByUser = await sql`
  SELECT a."userId",
         COUNT(*)::int AS intentos,
         BOOL_OR(a.passed) AS aprobo,
         MAX(a.score) AS mejor_score,
         MAX(a."submittedAt") AS ultimo
  FROM exam_attempts a
  GROUP BY a."userId"
`;

const examMap = new Map(examByUser.map((e) => [e.userId, e]));

const purchases = purchasesRaw
  .filter((p) => !isInternal(p.email))
  .filter((p) => Number(p.amountClp) >= 30000);

const completed = purchases.length;
const conExamen = purchases.filter((p) => examMap.has(p.userId));
const aprobaron = purchases.filter((p) => examMap.get(p.userId)?.aprobo);
const ingreso = purchases.reduce((s, p) => s + Number(p.amountClp), 0);

const byCity = {};
for (const p of purchases) {
  const city = (p.city || 'Sin ciudad').trim() || 'Sin ciudad';
  byCity[city] = (byCity[city] || 0) + 1;
}
const cityEntries = Object.entries(byCity).sort((a, b) => b[1] - a[1]);

const byMonth = {};
for (const p of purchases) {
  const d = new Date(p.createdAt);
  const key = d.toLocaleString('es-CL', { timeZone: 'America/Santiago', month: 'short', year: 'numeric' });
  byMonth[key] = (byMonth[key] || 0) + 1;
}
const monthEntries = Object.entries(byMonth).reverse();

const pieChart = await chartBuf({
  type: 'doughnut',
  data: {
    labels: ['Con examen', 'Sin examen'],
    datasets: [{
      data: [conExamen.length, Math.max(0, completed - conExamen.length)],
      backgroundColor: ['#12B4C6', '#e2e8f0'],
      borderWidth: 0,
    }],
  },
  options: {
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 11 } } },
      title: { display: true, text: 'Compradores vs examen', font: { size: 13, weight: 'bold' }, color: '#0b3d5c' },
      datalabels: { display: false },
    },
  },
}, 340, 260);

const barCity = await chartBuf({
  type: 'bar',
  data: {
    labels: cityEntries.map(([c]) => trunc(c, 14)),
    datasets: [{
      label: 'Compras',
      data: cityEntries.map(([, n]) => n),
      backgroundColor: '#12B4C6',
      borderRadius: 6,
    }],
  },
  options: {
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Compras por ciudad', font: { size: 13, weight: 'bold' }, color: '#0b3d5c' },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  },
}, 520, 260);

const lineMonth = await chartBuf({
  type: 'line',
  data: {
    labels: monthEntries.map(([m]) => m),
    datasets: [{
      label: 'Ventas',
      data: monthEntries.map(([, n]) => n),
      borderColor: '#0b3d5c',
      backgroundColor: 'rgba(18,180,198,0.25)',
      fill: true,
      tension: 0.35,
      pointBackgroundColor: '#12B4C6',
      pointRadius: 5,
    }],
  },
  options: {
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Evolución de ventas', font: { size: 13, weight: 'bold' }, color: '#0b3d5c' },
    },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
  },
}, 520, 240);

const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: {
  Title: 'Reporte de Ventas SCAI - 14 octubre 2026',
  Author: 'scairegionales.cl',
}});
const stream = createWriteStream(OUT);
doc.pipe(stream);

doc.rect(0, 0, doc.page.width, 122).fill(C.primary);
doc.rect(0, 114, doc.page.width, 8).fill(C.accent);
doc.fillColor(C.white).fontSize(9).font('Helvetica')
  .text('SCAI · SOCIEDAD CHILENA DE ALERGIA E INMUNOLOGÍA', 40, 24);
doc.fontSize(22).font('Helvetica-Bold')
  .text('Informe Comercial de Ventas', 40, 42);
doc.fontSize(10).font('Helvetica')
  .text('scairegionales.cl  ·  III Jornadas Regionales de Inmunología Clínica', 40, 72);
doc.fontSize(8).fillColor('#a8d5e0')
  .text(`Corte: miércoles 14 de octubre de 2026  ·  Generado: ${ahora} (Chile)`, 40, 92);

let y = 145;
const gap = 10;
const cardW = (doc.page.width - 80 - gap * 3) / 4;
drawCard(doc, 40, y, cardW, 72, 'Compras OK', completed, 'tickets confirmados', C.accent);
drawCard(doc, 40 + cardW + gap, y, cardW, 72, 'Ingreso total', money(ingreso), `${completed} × $30.000`, C.green);
drawCard(doc, 40 + (cardW + gap) * 2, y, cardW, 72, 'Rindieron examen', `${conExamen.length} de ${completed}`, 'compradores', C.orange);
drawCard(doc, 40 + (cardW + gap) * 3, y, cardW, 72, 'Aprobaron', aprobaron.length, 'examen aprobado', C.primary);

y = 235;
y = sectionTitle(doc, y, '1. Resumen ejecutivo');
doc.fillColor(C.text).fontSize(9.5).font('Helvetica')
  .text(
    `A la fecha se registran ${completed} compras confirmadas en scairegionales.cl, con un ingreso total de ${money(ingreso)}. ` +
    `Del total de compradores, ${conExamen.length} rindieron el examen del curso y ${aprobaron.length} lo aprobaron. ` +
    `El presente informe considera únicamente ventas reales a $30.000.`,
    40, y, { width: doc.page.width - 80, align: 'justify', lineGap: 2 },
  );
y = doc.y + 16;

y = sectionTitle(doc, y, '2. Indicadores visuales');
doc.image(pieChart, 50, y, { width: 190 });
doc.image(barCity, 250, y, { width: 300 });
y += 200;

y = ensureSpace(doc, y, 220);
doc.image(lineMonth, 50, y, { width: 500 });
y += 190;

y = ensureSpace(doc, y, 120);
y = sectionTitle(doc, y, '3. Listado de compras confirmadas');

const cols = [
  { label: '#', w: 22 },
  { label: 'Fecha', w: 70 },
  { label: 'Nombre', w: 110 },
  { label: 'Email', w: 130 },
  { label: 'Ciudad', w: 60 },
  { label: 'Monto', w: 48 },
  { label: 'Examen', w: 50 },
];
doc.roundedRect(40, y, doc.page.width - 80, 18, 4).fill(C.soft);
let x = 46;
doc.fillColor(C.primary).fontSize(7).font('Helvetica-Bold');
for (const col of cols) {
  doc.text(col.label, x, y + 5, { width: col.w, lineBreak: false });
  x += col.w;
}
y += 22;

let i = 1;
for (const p of purchases) {
  y = ensureSpace(doc, y, 28);
  const ex = examMap.get(p.userId);
  let examLabel = 'No';
  let examColor = C.red;
  if (ex?.aprobo) { examLabel = 'Aprobado'; examColor = C.green; }
  else if (ex) { examLabel = 'Rendido'; examColor = C.orange; }

  const row = [
    String(i),
    trunc(fmt(p.createdAt), 16),
    trunc(`${p.firstName} ${p.lastName}`, 22),
    trunc(p.email, 28),
    trunc(p.city || '—', 12),
    money(p.amountClp),
  ];
  x = 46;
  doc.fillColor(C.text).fontSize(7).font('Helvetica');
  for (let k = 0; k < row.length; k++) {
    doc.text(row[k], x, y + 2, { width: cols[k].w, lineBreak: false });
    x += cols[k].w;
  }
  doc.fillColor(examColor).font('Helvetica-Bold').text(examLabel, x, y + 2, { width: cols[6].w, lineBreak: false });
  y += 15;
  doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor(C.line).lineWidth(0.5).stroke();
  y += 3;
  i += 1;
}

y += 14;
y = ensureSpace(doc, y, 100);
y = sectionTitle(doc, y, '4. Detalle de compradores');

let n = 1;
for (const p of purchases) {
  y = ensureSpace(doc, y, 78);
  doc.roundedRect(40, y, doc.page.width - 80, 68, 8).fillAndStroke(C.white, C.line);
  doc.circle(56, y + 22, 10).fill(C.accent);
  doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold').text(String(n), 52, y + 18, { width: 10, align: 'center' });
  doc.fillColor(C.primary).fontSize(10).font('Helvetica-Bold')
    .text(trunc(`${p.firstName} ${p.lastName}`.trim(), 42), 74, y + 10);
  doc.fillColor(C.gray).fontSize(8).font('Helvetica')
    .text(`${p.email}`, 74, y + 26, { width: 280 });
  doc.text(`${p.city || '—'} · ${fmt(p.createdAt)} · ${money(p.amountClp)}`, 74, y + 38);
  doc.text(`${trunc(p.workplace || '—', 40)} · ${trunc(p.medicalArea || '—', 24)} · ${p.phoneNumber || '—'}`, 74, y + 50, {
    width: doc.page.width - 130,
  });
  const ex = examMap.get(p.userId);
  const badge = ex?.aprobo ? 'Examen OK' : ex ? 'Rendido' : 'Sin examen';
  const badgeColor = ex?.aprobo ? C.green : ex ? C.orange : C.red;
  doc.roundedRect(doc.page.width - 118, y + 12, 64, 16, 8).fill(badgeColor);
  doc.fillColor(C.white).fontSize(7).font('Helvetica-Bold')
    .text(badge, doc.page.width - 118, y + 16, { width: 64, align: 'center' });
  y += 78;
  n += 1;
}

if (conExamen.length) {
  y = ensureSpace(doc, y, 80);
  y = sectionTitle(doc, y, '5. Compradores que rindieron examen');
  for (const p of conExamen) {
    y = ensureSpace(doc, y, 30);
    const ex = examMap.get(p.userId);
    doc.fillColor(C.text).fontSize(9).font('Helvetica-Bold')
      .text(`${trunc(`${p.firstName} ${p.lastName}`, 35)} — ${p.email}`, 40, y);
    y += 12;
    doc.fillColor(C.gray).fontSize(8).font('Helvetica')
      .text(`Intentos: ${ex.intentos} · Mejor score: ${ex.mejor_score ?? '—'} · ${ex.aprobo ? 'APROBADO' : 'NO APROBADO'} · Último: ${fmt(ex.ultimo)}`, 40, y);
    y += 18;
  }
}

y = ensureSpace(doc, y, 70);
y += 8;
doc.roundedRect(40, y, doc.page.width - 80, 52, 8).fill(C.primary);
doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold')
  .text('Conclusión al 14-10-2026', 52, y + 12);
doc.fontSize(8).font('Helvetica').fillColor('#cfe8ee')
  .text(
    `${completed} compras confirmadas · Ingreso ${money(ingreso)} · ${conExamen.length} de ${completed} rindieron examen · ${aprobaron.length} aprobaron.`,
    52, y + 28, { width: doc.page.width - 110 },
  );

const pages = doc.bufferedPageRange();
for (let p = 0; p < pages.count; p++) {
  doc.switchToPage(p);
  doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
    .text(`SCAI Regionales · Informe comercial 14-10-2026 · Página ${p + 1} de ${pages.count}`, 40, doc.page.height - 28, {
      width: doc.page.width - 80, align: 'center',
    });
}

doc.end();
await new Promise((resolve, reject) => {
  stream.on('finish', resolve);
  stream.on('error', reject);
});

console.log(JSON.stringify({
  out: OUT,
  ahora,
  completed,
  ingreso,
  rindieron: conExamen.length,
  aprobaron: aprobaron.length,
  emails: purchases.map((p) => `${p.firstName} ${p.lastName} <${p.email}>`),
}, null, 2));
