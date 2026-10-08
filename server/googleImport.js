import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to find files in current or parent directory
function getPath(filename) {
  let fullPath = path.resolve(__dirname, filename);
  if (fs.existsSync(fullPath)) return fullPath;
  fullPath = path.resolve(__dirname, '..', filename);
  if (fs.existsSync(fullPath)) return fullPath;
  return path.resolve(process.cwd(), filename);
}

// Load .env
dotenv.config({ path: getPath('.env') });

const prisma = new PrismaClient();
const CREDENTIALS_PATH = getPath('credentials.json');

async function main() {
  console.log('📥 Starting Google Sheets player data import...');

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`❌ Error: credentials.json is missing. Checked: ${CREDENTIALS_PATH}`);
    process.exit(1);
  }

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error('❌ Error: SPREADSHEET_ID is missing in .env');
    process.exit(1);
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log(`📡 Fetching player list from spreadsheet ID: ${spreadsheetId}...`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '티어 정리!A2:N200',
    });

    const rows = response.data.values || [];
    console.log(`✅ Loaded ${rows.length} rows from Google Sheet.`);

    let importCount = 0;
    
    for (const row of rows) {
      if (!row[2]) continue; // check if Name exists (Column C)
      
      const name = row[2].trim();
      const age = row[3] || '';
      const nickname = row[4] || '';
      const currentTier = row[5] || '';
      const highestTier = row[6] || '';
      const lineTop = row[8]?.toUpperCase() === 'O';
      const lineJungle = row[9]?.toUpperCase() === 'O';
      const lineMid = row[10]?.toUpperCase() === 'O';
      const lineAd = row[11]?.toUpperCase() === 'O';
      const lineSupport = row[12]?.toUpperCase() === 'O';
      const maxTierSort = parseInt(row[13]) || 26;

      // Use a self-healing guest ID. When they join Discord lobby, we'll update it to their actual Discord ID.
      const dummyId = `guest_${name}`;

      // Insert or update player
      await prisma.player.upsert({
        where: { name },
        update: {
          age,
          nickname,
          currentTier,
          highestTier,
          lineTop,
          lineJungle,
          lineMid,
          lineAd,
          lineSupport,
          maxTierSort,
        },
        create: {
          id: dummyId,
          name,
          age,
          nickname,
          currentTier,
          highestTier,
          lineTop,
          lineJungle,
          lineMid,
          lineAd,
          lineSupport,
          maxTierSort,
          wins: 0,
          losses: 0,
          mmr: 1000,
        }
      });

      importCount++;
    }

    console.log(`\n🎉 Success! Successfully imported/updated ${importCount} players in the SQLite database.`);
  } catch (error) {
    console.error('❌ Error during import:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
