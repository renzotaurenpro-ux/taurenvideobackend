import { createReadStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const CSV_PATH = 'C:/Users/reasd/Downloads/BBDD Asistentes III Jornadas regionales.csv';
const OUT = 'C:/Users/reasd/Downloads/Participantes_Umbral_50_SCAI_2026.csv';
const STREAM_START = new Date('2026-06-19T07:51:45');
const STREAM_END = new Date('2026-06-19T18:52:03');
const STREAM_DURATION_MIN = (STREAM_END - STREAM_START) / 60000;
const THRESHOLD = 0.5;

function parseLocalDateTime(str) {
  const cleaned = str.trim().replace(/"/g, '');
  const [datePart, timePart, ampm] = cleaned.split(' ');
  const [day, month, year] = datePart.split('/');
  let [h, m, s] = timePart.split(':').map(Number);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
}

function calcEffectiveMinutes(entryStr, exitStr) {
  try {
    const entry = parseLocalDateTime(entryStr);
    const exit = parseLocalDateTime(exitStr);
    const clampedEntry = entry < STREAM_START ? STREAM_START : entry;
    const clampedExit = exit > STREAM_END ? STREAM_END : exit;
    if (clampedExit <= clampedEntry) return 0;
    return (clampedExit - clampedEntry) / 60000;
  } catch {
    return 0;
  }
}

async function readCSV(path) {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  const rows = [];
  let header = true;
  for await (const line of rl) {
    if (header) { header = false; continue; }
    if (!line.trim()) continue;
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
    if (cols.length < 5) continue;
    const name = cols[0].replace(/"/g, '').trim();
    const email = cols[1].replace(/"/g, '').trim().toLowerCase();
    const entryStr = cols[2].replace(/"/g, '').trim();
    const exitStr = cols[3].replace(/"/g, '').trim();
    if (!email.includes('@')) continue;
    rows.push({ name, email, entryStr, exitStr });
  }
  return rows;
}

const csvRows = await readCSV(CSV_PATH);
const byEmail = new Map();

for (const r of csvRows) {
  const mins = calcEffectiveMinutes(r.entryStr, r.exitStr);
  if (!byEmail.has(r.email)) {
    byEmail.set(r.email, { name: r.name, email: r.email, totalMins: 0, sessions: 0 });
  }
  const e = byEmail.get(r.email);
  e.totalMins += mins;
  e.sessions += 1;
}

const exportRows = [...byEmail.values()].map((a) => {
  const pct = Math.min(Math.round((a.totalMins / STREAM_DURATION_MIN) * 1000) / 10, 100);
  const cumple = pct >= THRESHOLD * 100;
  return {
    nombre: a.name.replace(/,/g, ' '),
    email: a.email,
    pct,
    minutos: Math.round(a.totalMins),
    sesiones: a.sessions,
    cumple: cumple ? 'Sí' : 'No',
    estado: cumple ? 'APROBADO' : 'NO APROBADO',
  };
});

exportRows.sort((a, b) => b.pct - a.pct || a.nombre.localeCompare(b.nombre));

const header = 'Nombre,Correo electrónico,Minutos totales,Porcentaje visualización (%),Sesiones Zoom,Cumple 50%,Estado\n';
const body = exportRows
  .map((r) => `${r.nombre},${r.email},${r.minutos},${r.pct},${r.sesiones},${r.cumple},${r.estado}`)
  .join('\n');

writeFileSync(OUT, '\uFEFF' + header + body, { encoding: 'utf8' });

const aprobados = exportRows.filter((r) => r.estado === 'APROBADO');
console.log(`Archivo: ${OUT}`);
console.log(`Filas CSV origen: ${csvRows.length}`);
console.log(`Participantes únicos: ${exportRows.length}`);
console.log(`Aprobados 50%: ${aprobados.length} | No aprobados: ${exportRows.length - aprobados.length}`);
