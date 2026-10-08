import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeTier } from './riotApi.js';

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

dotenv.config({ path: getPath('.env') });

const CREDENTIALS_PATH = getPath('credentials.json');

// Initialize sheets client if credentials file exists
let sheets = null;

function initSheets() {
  if (sheets) return sheets;

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.warn('⚠️ [Google Sheets] credentials.json file is missing in the root directory.');
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

/**
 * Helper to convert Player object to C~M row array
 * C: 이름, D: 나이, E: 닉네임, F: 현티어, G: 최고티어, H: 라인, I: 탑, J: 정글, K: 미드, L: 원딜, M: 서폿
 */
function playerToRowValues(player) {
  const cur = sanitizeTier(player.currentTier) || '언랭';
  const high = sanitizeTier(player.highestTier) || cur;
  return [
    player.name || '',
    player.age ? String(player.age) : '',
    player.nickname || '',
    cur,
    high,
    player.mainPosition || '',
    player.lineTop ? 'O' : '',
    player.lineJungle ? 'O' : '',
    player.lineMid ? 'O' : '',
    player.lineAd ? 'O' : '',
    player.lineSupport ? 'O' : '',
  ];
}


/**
 * Updates or appends a single player's data in the '티어 정리' sheet (Columns C to M only).
 * Guaranteed NOT to touch columns N and O.
 * @param {object} player 
 * @returns {Promise<boolean>}
 */
export async function syncPlayerToSheet(player) {
  const client = initSheets();
  if (!client) return false;

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) return false;

  const tabName = '티어 정리';

  try {
    // 1. Fetch current names in Column C (from C2 to C200)
    const response = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!C2:C200`,
    });

    const rows = response.data.values || [];
    let targetRowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const cellName = rows[i][0] ? rows[i][0].trim() : '';
      if (cellName === player.name) {
        targetRowIndex = i + 2; // 1-indexed, starting from row 2
        break;
      }
    }

    if (targetRowIndex === -1) {
      // Not found, find first empty row or append at the end
      targetRowIndex = rows.length + 2;
    }

    const rowValues = playerToRowValues(player);
    const range = `'${tabName}'!C${targetRowIndex}:M${targetRowIndex}`;

    await client.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues],
      },
    });

    console.log(`✅ [Google Sheets] Synced player ${player.name} to range ${range}`);
    return true;
  } catch (error) {
    console.error(`❌ [Google Sheets] Error syncing player ${player.name}:`, error.message);
    return false;
  }
}

/**
 * Updates multiple players in the '티어 정리' sheet (Columns C to M only).
 * Leaves N, O and other columns completely untouched.
 * @param {Array<object>} players 
 * @returns {Promise<boolean>}
 */
export async function syncAllPlayersToSheet(players) {
  const client = initSheets();
  if (!client) return false;

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) return false;

  const tabName = '티어 정리';

  try {
    const response = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!C2:C200`,
    });

    const rows = response.data.values || [];
    const nameToRowMap = new Map();

    for (let i = 0; i < rows.length; i++) {
      const cellName = rows[i][0] ? rows[i][0].trim() : '';
      if (cellName) {
        nameToRowMap.set(cellName, i + 2);
      }
    }

    const updateData = [];
    let nextAvailableRow = rows.length + 2;

    for (const player of players) {
      let rowIndex = nameToRowMap.get(player.name);
      if (!rowIndex) {
        rowIndex = nextAvailableRow++;
        nameToRowMap.set(player.name, rowIndex);
      }

      updateData.push({
        range: `'${tabName}'!C${rowIndex}:M${rowIndex}`,
        values: [playerToRowValues(player)],
      });
    }

    if (updateData.length > 0) {
      await client.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updateData,
        },
      });
      console.log(`✅ [Google Sheets] Successfully batch-synced ${updateData.length} players to C~M.`);
    }

    return true;
  } catch (error) {
    console.error('❌ [Google Sheets] Error batch syncing players:', error.message);
    return false;
  }
}

/**
 * Updates 1팀(블루) and 2팀(레드) in the Google Sheet if ranges or sheet is configured.
 * @param {string[]} blueTeam - Array of 5 player names
 * @param {string[]} redTeam - Array of 5 player names
 * @returns {Promise<boolean>}
 */
export async function updateTeamsToSheet(blueTeam, redTeam) {
  const client = initSheets();
  if (!client) return false;

  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = process.env.SHEET_NAME || '시트1';
  if (!spreadsheetId) return false;

  const blueRange = process.env.SHEET_TEAMS_BLUE_RANGE || `'${sheetName}'!E2:E6`;
  const redRange = process.env.SHEET_TEAMS_RED_RANGE || `'${sheetName}'!G2:G6`;

  try {
    const blueValues = (blueTeam || []).map(name => [name]);
    const redValues = (redTeam || []).map(name => [name]);

    await client.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: blueRange, values: blueValues },
          { range: redRange, values: redValues },
        ],
      },
    });

    console.log(`✅ [Google Sheets] Updated Blue/Red teams to Google Sheet.`);
    return true;
  } catch (error) {
    console.warn(`⚠️ [Google Sheets] Could not write teams to sheet:`, error.message);
    return false;
  }
}
