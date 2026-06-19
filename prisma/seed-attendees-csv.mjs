import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CSV_PATH = resolve('C:/Users/reasd/Desktop/participants_89546596668_2026_06_19.csv');

const STREAM_START = new Date('2026-06-19T07:51:45');
const STREAM_END   = new Date('2026-06-19T18:52:03');
const STREAM_DURATION_MIN = (STREAM_END - STREAM_START) / 60000;
const THRESHOLD = 0.8;

function parseLocalDateTime(str) {
  const cleaned = str.trim().replace(/"/g, '');
  const [datePart, timePart, ampm] = cleaned.split(' ');
  const [day, month, year] = datePart.split('/');
  let [h, m, s] = timePart.split(':').map(Number);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
}

function parseName(fullName) {
  const parts = fullName.trim().split(' ');
  const firstName = parts[0] || 'Sin nombre';
  const lastName = parts.slice(1).join(' ') || '-';
  return { firstName, lastName };
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
    const durMin = parseInt(cols[4].replace(/"/g, '').trim(), 10) || 0;
    if (!email || !email.includes('@')) continue;
    rows.push({ name, email, entryStr, exitStr, durMin });
  }
  return rows;
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

try {
  const rows = await readCSV(CSV_PATH);

  const byEmail = new Map();
  for (const r of rows) {
    const mins = calcEffectiveMinutes(r.entryStr, r.exitStr);
    if (!byEmail.has(r.email)) {
      byEmail.set(r.email, { name: r.name, email: r.email, totalMins: 0 });
    }
    byEmail.get(r.email).totalMins += mins;
  }

  const attendees = [...byEmail.values()].map(a => ({
    ...a,
    pct: a.totalMins / STREAM_DURATION_MIN,
    watchedOver80: a.totalMins / STREAM_DURATION_MIN >= THRESHOLD,
  }));

  const maxAttendee = attendees.reduce((a, b) => a.totalMins > b.totalMins ? a : b);
  const minAttendee = attendees.reduce((a, b) => a.totalMins < b.totalMins ? a : b);
  const over80 = attendees.filter(a => a.watchedOver80);
  const under80 = attendees.filter(a => !a.watchedOver80);

  console.log(`\nStream: ${STREAM_DURATION_MIN.toFixed(1)} min totales`);
  console.log(`Total asistentes únicos: ${attendees.length}`);
  console.log(`Con +80%: ${over80.length} | Sin 80%: ${under80.length}`);
  console.log(`\n--- MÁS TIEMPO ---`);
  console.log(`  ${maxAttendee.name} <${maxAttendee.email}>`);
  console.log(`  ${maxAttendee.totalMins.toFixed(1)} min (${(maxAttendee.pct*100).toFixed(1)}%) | +80%: ${maxAttendee.watchedOver80}`);
  console.log(`\n--- MENOS TIEMPO ---`);
  console.log(`  ${minAttendee.name} <${minAttendee.email}>`);
  console.log(`  ${minAttendee.totalMins.toFixed(1)} min (${(minAttendee.pct*100).toFixed(1)}%) | +80%: ${minAttendee.watchedOver80}`);

  console.log('\nImportando a la base de datos...');
  let created = 0, updated = 0;

  for (const a of attendees) {
    const { firstName, lastName } = parseName(a.name);
    const existing = await prisma.attendanceEligibility.findUnique({ where: { email: a.email } });
    if (existing) {
      await prisma.attendanceEligibility.update({
        where: { email: a.email },
        data: { firstName, lastName, watchedOver80: a.watchedOver80 },
      });
      updated++;
    } else {
      await prisma.attendanceEligibility.create({
        data: { email: a.email, firstName, lastName, watchedOver80: a.watchedOver80 },
      });
      created++;
    }
  }

  console.log(`\nImportación completa: ${created} creados, ${updated} actualizados`);
  console.log('\n=== EMAILS PARA PROBAR ===');
  console.log(`MÁS TIEMPO (${maxAttendee.watchedOver80 ? '+80%' : 'sin 80%'}): ${maxAttendee.email}`);
  console.log(`MENOS TIEMPO (${minAttendee.watchedOver80 ? '+80%' : 'sin 80%'}): ${minAttendee.email}`);
} finally {
  await prisma.$disconnect();
}
