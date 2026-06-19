import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CSV_PATH = 'C:/Users/reasd/Downloads/BBDD Asistentes III Jornadas regionales.csv';
const STREAM_START = new Date('2026-06-19T07:51:45');
const STREAM_END = new Date('2026-06-19T18:52:03');
const STREAM_DURATION_MIN = (STREAM_END - STREAM_START) / 60000;
const THRESHOLD = 0.8;

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
  const entry = parseLocalDateTime(entryStr);
  const exit = parseLocalDateTime(exitStr);
  const clampedEntry = entry < STREAM_START ? STREAM_START : entry;
  const clampedExit = exit > STREAM_END ? STREAM_END : exit;
  if (clampedExit <= clampedEntry) return 0;
  return (clampedExit - clampedEntry) / 60000;
}

async function readCSV(path) {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'latin1' }), crlfDelay: Infinity });
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

try {
  const rows = await readCSV(CSV_PATH);
  const byEmail = new Map();
  for (const r of rows) {
    const mins = calcEffectiveMinutes(r.entryStr, r.exitStr);
    if (!byEmail.has(r.email)) byEmail.set(r.email, { name: r.name, email: r.email, totalMins: 0, sessions: 0 });
    const e = byEmail.get(r.email);
    e.totalMins += mins;
    e.sessions += 1;
  }

  const attendees = [...byEmail.values()].map((a) => ({
    ...a,
    pct: Math.round((a.totalMins / STREAM_DURATION_MIN) * 1000) / 10,
    watchedOver80: a.totalMins / STREAM_DURATION_MIN >= THRESHOLD,
  }));

  attendees.sort((a, b) => b.totalMins - a.totalMins);

  const db = await prisma.attendanceEligibility.findMany();
  const dbMap = new Map(db.map((d) => [d.email.toLowerCase(), d]));

  let match = 0;
  let mismatch = 0;
  const missingInDb = [];
  const wrongFlag = [];

  for (const a of attendees) {
    const row = dbMap.get(a.email);
    if (!row) {
      missingInDb.push(a.email);
      continue;
    }
    if (row.watchedOver80 === a.watchedOver80) match++;
    else {
      mismatch++;
      wrongFlag.push({ email: a.email, csv: a.watchedOver80, db: row.watchedOver80 });
    }
  }

  const extraInDb = db.filter((d) => !byEmail.has(d.email.toLowerCase()));

  console.log('=== RESUMEN BASE DE DATOS ===');
  console.log(`Stream total: ${STREAM_DURATION_MIN.toFixed(1)} min | Umbral 80%: ${(STREAM_DURATION_MIN * 0.8).toFixed(1)} min`);
  console.log(`Filas CSV: ${rows.length} | Emails únicos CSV: ${attendees.length}`);
  console.log(`Registros en BD: ${db.length}`);
  console.log(`Con +80% CSV: ${attendees.filter((a) => a.watchedOver80).length} | Sin 80%: ${attendees.filter((a) => !a.watchedOver80).length}`);
  console.log(`Con +80% BD: ${db.filter((d) => d.watchedOver80).length} | Sin 80%: ${db.filter((d) => !d.watchedOver80).length}`);
  console.log(`Coincidencias watchedOver80: ${match} | Errores: ${mismatch} | Faltan en BD: ${missingInDb.length} | Extra en BD: ${extraInDb.length}`);

  console.log('\n=== TOP 10 MÁS TIEMPO ===');
  for (const a of attendees.slice(0, 10)) {
    console.log(`${a.name} | ${a.email} | ${Math.round(a.totalMins)} min (${a.pct}%) | ${a.sessions} sesiones | +80%: ${a.watchedOver80 ? 'Sí' : 'No'}`);
  }

  console.log('\n=== TOP 10 MENOS TIEMPO ===');
  for (const a of [...attendees].reverse().slice(0, 10)) {
    console.log(`${a.name} | ${a.email} | ${Math.round(a.totalMins)} min (${a.pct}%) | ${a.sessions} sesiones | +80%: ${a.watchedOver80 ? 'Sí' : 'No'}`);
  }

  if (wrongFlag.length) console.log('\nErrores de flag:', wrongFlag);
  if (missingInDb.length) console.log('\nFaltan en BD:', missingInDb.slice(0, 5), missingInDb.length > 5 ? `... +${missingInDb.length - 5}` : '');
  if (extraInDb.length) console.log('\nExtra en BD (test):', extraInDb.map((d) => d.email));
} finally {
  await prisma.$disconnect();
}
