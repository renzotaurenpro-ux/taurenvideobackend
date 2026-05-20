import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createReadStream, statSync } from 'fs';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const libraryId = process.env.BUNNY_LIBRARY_ID;
const apiKey = process.env.BUNNY_API_KEY;
const baseUrl = 'https://video.bunnycdn.com';
const videosDir = 'C:\\Users\\reasd\\Desktop\\taurenvidio\\taurenvideo\\public\\videos';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function createSlot(title) {
  const res = await fetch(`${baseUrl}/library/${libraryId}/videos`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`create failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.guid;
}

async function uploadBinary(guid, filePath) {
  const stat = statSync(filePath);
  const stream = createReadStream(filePath);
  const res = await fetch(`${baseUrl}/library/${libraryId}/videos/${guid}`, {
    method: 'PUT',
    headers: {
      AccessKey: apiKey,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(stat.size),
    },
    body: stream,
    duplex: 'half',
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
}

function matchFiles() {
  const names = fs.readdirSync(videosDir);
  const primera = names.find((n) => n.includes('Primera'));
  const segunda = names.find((n) => n.includes('Segunda'));
  const tercera = names.find((n) => n.includes('Tercera'));
  if (!primera || !segunda || !tercera) {
    throw new Error(`Archivos no encontrados: ${names.join(', ')}`);
  }
  return [
    { order: 1, title: 'Modulo 1 - Primera Clase', file: path.join(videosDir, primera) },
    { order: 2, title: 'Modulo 1 - Segunda Presentación', file: path.join(videosDir, segunda) },
    { order: 3, title: 'Modulo 1 - Tercera Presentación', file: path.join(videosDir, tercera) },
  ];
}

try {
  const items = matchFiles();

  await prisma.purchase.deleteMany({});
  await prisma.video.deleteMany({});
  console.log('Videos anteriores eliminados de BD.');

  for (const item of items) {
    console.log(`Subiendo: ${item.title} (${item.file})...`);
    const guid = await createSlot(item.title);
    await uploadBinary(guid, item.file);
    const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}`;
    const video = await prisma.video.create({
      data: {
        title: item.title,
        description: 'III Jornadas Regionales de Inmunología Clínica',
        url: embedUrl,
        bunnyVideoId: guid,
        priceClp: 25000,
        order: item.order,
        published: true,
      },
    });
    console.log('OK:', video.id, guid);
  }

  console.log('Listo. 3 videos subidos a Bunny y registrados en BD.');
} finally {
  await prisma.$disconnect();
}
