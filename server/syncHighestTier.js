import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeTier } from './riotApi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPath(filename) {
  let fullPath = path.resolve(__dirname, filename);
  if (fs.existsSync(fullPath)) return fullPath;
  fullPath = path.resolve(__dirname, '..', filename);
  if (fs.existsSync(fullPath)) return fullPath;
  return path.resolve(process.cwd(), filename);
}

dotenv.config({ path: getPath('.env') });

const prisma = new PrismaClient();
const CREDENTIALS_PATH = getPath('credentials.json');

async function main() {
  console.log('🔄 Fetching highest tiers from Google Sheet...');

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '티어 정리!C2:G200',
  });

  const rows = res.data.values || [];
  let updatedCount = 0;

  for (const row of rows) {
    if (!row[0]) continue;
    const name = row[0].trim();
    const sheetHighestTier = sanitizeTier(row[4]);
    if (!sheetHighestTier) continue;

    const existing = await prisma.player.findUnique({ where: { name } });
    if (existing) {
      await prisma.player.update({
        where: { name },
        data: { highestTier: sheetHighestTier }
      });
      console.log(`✅ [${name}] Highest Tier updated to: "${sheetHighestTier}"`);
      updatedCount++;
    }

  }

  console.log(`\n🎉 Successfully synced highestTier for ${updatedCount} players to DB!`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
