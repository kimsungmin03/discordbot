import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const CREDENTIALS_PATH = 'credentials.json';

// Initialize sheets client if credentials file exists
let sheets = null;

function initSheets() {
  if (sheets) return sheets;

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.warn('⚠️ [Google Sheets] credentials.json file is missing in the root directory.');
    console.warn('⚠️ Google Sheets integration will not work until credentials.json is provided.');
    return null;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheets = google.sheets({ version: 'v4', auth });
    return sheets;
  } catch (error) {
    console.error('❌ [Google Sheets] Error initializing Google Auth:', error.message);
    return null;
  }
}

/**
 * Normalizes LoL line preferences from text to O/X format.
 * e.g., "원딜, 미드" -> "탑(X) 정글(X) 미드(O) 원딜(O) 서폿(X)"
 */
function normalizeLine(lineStr) {
  if (!lineStr) return '탑(X) 정글(X) 미드(X) 원딜(X) 서폿(X)';
  const lower = lineStr.toLowerCase().replace(/\s+/g, '');
  const isAll = lower.includes('all');
  
  const top = isAll || lower.includes('탑') ? 'O' : 'X';
  const jg = isAll || lower.includes('정글') ? 'O' : 'X';
  const mid = isAll || lower.includes('미드') ? 'O' : 'X';
  const ad = isAll || lower.includes('원딜') ? 'O' : 'X';
  const sup = isAll || lower.includes('서폿') ? 'O' : 'X';
  
  return `탑(${top}) 정글(${jg}) 미드(${mid}) 원딜(${ad}) 서폿(${sup})`;
}

/**
 * Fetches the user tier list data from the '티어 정리' sheet tab.
 * Returns a Map of name -> details
 */
async function getTierData(client, spreadsheetId) {
  try {
    const response = await client.spreadsheets.values.get({
      spreadsheetId,
      range: '티어 정리!A2:L200', // Read up to 200 rows of player tier entries starting from Column A
    });
    
    const rows = response.data.values || [];
    const tierMap = new Map();
    
    for (const row of rows) {
      if (!row[0]) continue;
      const name = row[0].trim();       // Column A: 이름
      const age = row[1] || '';         // Column B: 나이
      const nick = row[2] || '';        // Column C: 닉네임
      const curTier = row[3] || '';     // Column D: 현티어
      const maxTier = row[4] || '';     // Column E: 최고티어
      const line = row[5] || '';        // Column F: 라인
      const lineTop = row[6]?.toUpperCase() === 'O';      // Column G: 탑
      const lineJungle = row[7]?.toUpperCase() === 'O';   // Column H: 정글
      const lineMid = row[8]?.toUpperCase() === 'O';      // Column I: 미드
      const lineAd = row[9]?.toUpperCase() === 'O';       // Column J: 원딜
      const lineSupport = row[10]?.toUpperCase() === 'O'; // Column K: 서폿
      const maxTierSort = row[11] || '';                  // Column L: 최고티어정렬
      
      tierMap.set(name, { 
        age, 
        nick, 
        curTier, 
        maxTier, 
        line, 
        lineTop, 
        lineJungle, 
        lineMid, 
        lineAd, 
        lineSupport, 
        maxTierSort 
      });
    }
    
    return tierMap;
  } catch (error) {
    console.warn('⚠️ [Google Sheets] Error fetching tier data from "티어 정리":', error.message);
    return new Map();
  }
}

/**
 * Updates the range C2:C11 of the specified sheet with the current participant list.
 * Leaves all other columns untouched (they are managed by formulas).
 * @param {string[]} participants - Array of participant usernames (up to 10)
 * @returns {Promise<boolean>} - True if update succeeded, false otherwise
 */
export async function updateParticipants(participants) {
  const client = initSheets();
  if (!client) {
    console.error('❌ [Google Sheets] Sheets client not initialized. Check credentials.json.');
    return false;
  }

  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = process.env.SHEET_NAME || '시트1';

  if (!spreadsheetId) {
    console.error('❌ [Google Sheets] SPREADSHEET_ID environment variable is missing in .env.');
    return false;
  }

  try {
    // Build 10 rows of C2:C11 (1 column)
    const rows = [];
    for (let i = 0; i < 10; i++) {
      const name = participants[i] ? participants[i].trim() : '';
      rows.push([name]);
    }

    const range = `'${sheetName}'!C2:C11`;

    await client.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });

    console.log(`✅ [Google Sheets] Successfully updated range ${range} with ${participants.length} players.`);
    return true;
  } catch (error) {
    console.error('❌ [Google Sheets] Error updating sheet:', error.message);
    return false;
  }
}


