import { updateParticipants } from './googleSheets.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function runTest() {
  console.log('🧪 Starting Google Sheets connection test...');

  if (!fs.existsSync('credentials.json')) {
    console.error('❌ Error: credentials.json is missing in the root directory.');
    console.error('Please create the file by downloading your Google Service Account key.');
    process.exit(1);
  }

  if (!process.env.SPREADSHEET_ID) {
    console.error('❌ Error: SPREADSHEET_ID is missing in your .env file.');
    process.exit(1);
  }

  console.log(`📋 SPREADSHEET_ID: ${process.env.SPREADSHEET_ID}`);
  console.log(`📋 SHEET_NAME: ${process.env.SHEET_NAME || 'Sheet1'}`);

  const testPlayers = [
    '페이커',
    '제우스',
    '오너',
    '구마유시',
    '케리아',
    '도란',
    '피넛',
    '제카',
    '바이퍼',
    '딜라이트'
  ];

  console.log(`📝 Writing 10 test player names:`, testPlayers);

  const success = await updateParticipants(testPlayers);

  if (success) {
    console.log('\n✅ Success! Please check your Google Sheet to verify that C2:C11 contains the 10 players.');
  } else {
    console.log('\n❌ Failure. Please check the error logs above for troubleshooting.');
  }
}

runTest();
