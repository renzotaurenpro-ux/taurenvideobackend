import { createReadStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const CSV_IN  = 'C:/Users/reasd/Downloads/BBDD Asistentes III Jornadas regionales.csv';
const CSV_OUT = 'C:/Users/reasd/Downloads/Asistentes_SinDuplicados_SCAI_2026.csv';

const STREAM_START = new Date('2026-06-19T07:51:45');
const STREAM_END   = new Date('2026-06-19T18:52:03');
const STREAM_DURATION_MIN = (STREAM_END - STREAM_START) / 60000;

function parseLocalDateTime(str) {
  const cleaned = str.trim().replace(/"/g, '');
  const [datePart, timePart, ampm] = cleaned.split(' ');
  const [day, month, year] = datePart.split('/');
  let [h, m, s] = timePart.split(':').map(Number);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
}

function calcEffectiveMinutes(entryStr, exitStr) {
  try {
    const entry = parseLocalDateTime(entryStr);
    const exit  = parseLocalDateTime(exitStr);
    const clampedEntry = entry < STREAM_START ? STREAM_START : entry;
    const clampedExit  = exit  > STREAM_END   ? STREAM_END   : exit;
    if (clampedExit <= clampedEntry) return 0;
    return (clampedExit - clampedEntry) / 60000;
  } catch { return 0; }
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
    const name  = cols[0].replace(/"/g, '').trim();
    const email = cols[1].replace(/"/g, '').trim().toLowerCase();
    const entry = cols[2].replace(/"/g, '').trim();
    const exit  = cols[3].replace(/"/g, '').trim();
    if (!email.includes('@')) continue;
    rows.push({ name, email, entry, exit });
  }
  return rows;
}

function fixEncoding(str) {
  try {
    return Buffer.from(str, 'latin1').toString('utf8');
  } catch {
    return str;
  }
}

const rows = await readCSV(CSV_IN);

const byEmail = new Map();
for (const r of rows) {
  const mins = calcEffectiveMinutes(r.entry, r.exit);
  if (!byEmail.has(r.email)) {
    byEmail.set(r.email, { name: r.name, email: r.email, totalMins: 0, sessions: 0 });
  }
  const e = byEmail.get(r.email);
  e.totalMins += mins;
  e.sessions  += 1;
}

const attendees = [...byEmail.values()].map(a => ({
  ...a,
  pct: Math.min(Math.round((a.totalMins / STREAM_DURATION_MIN) * 1000) / 10, 100),
  over50: a.totalMins / STREAM_DURATION_MIN >= 0.5,
}));

attendees.sort((a, b) => b.totalMins - a.totalMins);

const header = 'Nombre,Correo electrónico,Minutos totales,Porcentaje visualización (%),Vio más del 50%,Sesiones Zoom\n';
const body = attendees.map(a =>
  `${a.name},${a.email},${Math.round(a.totalMins)},${a.pct},${a.over50 ? 'Sí' : 'No'},${a.sessions}`
).join('\n');

writeFileSync(CSV_OUT, '\uFEFF' + header + body, { encoding: 'utf8' });

console.log(`Archivo generado: ${CSV_OUT}`);
console.log(`Total personas únicas: ${attendees.length}`);
console.log(`Con +50%: ${attendees.filter(a => a.over50).length} | Sin 50%: ${attendees.filter(a => !a.over50).length}`);
console.log(`\nTop 5 más tiempo:`);
attendees.slice(0, 5).forEach(a => console.log(`  ${a.name} | ${a.pct}% | ${Math.round(a.totalMins)} min`));
console.log(`\nTop 5 menos tiempo:`);
[...attendees].reverse().slice(0, 5).forEach(a => console.log(`  ${a.name} | ${a.pct}% | ${Math.round(a.totalMins)} min`));
