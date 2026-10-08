import dotenv from 'dotenv';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const CREDENTIALS_PATH = path.resolve(__dirname, '..', 'credentials.json');

async function main() {
  console.log('🔄 Cleaning up tier formatting in Google Sheet...');

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '티어 정리!F2:G100',
  });

  const rows = res.data.values || [];
  const regex = /^(아이언|브론즈|실버|골드|플레|에메|다이아)\s*([1-4])$/;
  const updateData = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let cur = row[0] ? String(row[0]).trim() : '';
    let high = row[1] ? String(row[1]).trim() : '';
    let changed = false;

    if (cur && regex.test(cur)) {
      const newCur = cur.replace(regex, '$1$2');
      if (newCur !== cur) {
        cur = newCur;
        changed = true;
      }
    }

    if (high && regex.test(high)) {
      const newHigh = high.replace(regex, '$1$2');
      if (newHigh !== high) {
        high = newHigh;
        changed = true;
      }
    }

    if (changed) {
      const rowIndex = i + 2;
      updateData.push({
        range: `'티어 정리'!F${rowIndex}:G${rowIndex}`,
        values: [[cur, high]],
      });
    }
  }

  if (updateData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updateData,
      },
    });
    console.log(`✅ Successfully updated ${updateData.length} rows in Google Sheet without touching formulas!`);
  } else {
    console.log('✅ All rows in Google Sheet already use the new format.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error cleaning sheet tiers:', err);
  process.exit(1);
});
