import { PrismaClient } from '@prisma/client';
import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
const CSV_PATH = getPath('members (minutes).csv');

if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ CSV file not found at ${CSV_PATH}`);
  process.exit(1);
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token || !guildId) {
  console.error('❌ DISCORD_TOKEN or GUILD_ID is missing in .env');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('clientReady', async () => {
  console.log(`🤖 Temporary bot ready as ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(guildId);
    console.log(`📡 Connected to guild: ${guild.name}`);

    // Clean total voice times and logs in MySQL first to prevent duplicates
    console.log('🧹 Resetting player voice times and clearing detailed logs in database...');
    await prisma.player.updateMany({ data: { totalVoiceTime: 0 } });
    await prisma.voiceLog.deleteMany({});
    console.log('✅ Database reset complete.');

    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = fileContent.split('\n').map(l => l.trim()).filter(Boolean);
    const dataLines = lines.slice(1); // Skip header

    console.log(`📥 Processing ${dataLines.length} rows from members (minutes).csv...`);

    let bindCount = 0;
    let updateCount = 0;
    let createCount = 0;

    const targetDate = new Date('2026-08-13T12:00:00Z');

    for (const line of dataLines) {
      const parts = parseCsvLine(line);
      if (parts.length < 4) continue;

      const rank = parts[0];
      const username = parts[1];
      const userId = parts[2];
      const minutes = parseFloat(parts[3]);

      if (isNaN(minutes) || !userId) continue;

      const seconds = Math.round(minutes * 60);

      // Check if player exists by exact Discord ID
      let player = await prisma.player.findUnique({
        where: { id: userId },
      });

      let playerName = '';

      if (player) {
        // Player exists, update their voice time
        await prisma.player.update({
          where: { id: userId },
          data: {
            totalVoiceTime: { increment: seconds },
          },
        });
        playerName = player.name;
        updateCount++;
      } else {
        // Fetch user display name from Guild to check for dummy guest records
        const member = await guild.members.fetch(userId).catch(() => null);
        let searchName = '';
        if (member) {
          const displayName = member.displayName || member.user.username;
          searchName = displayName.trim().slice(0, 3);
        } else {
          // Fallback: searchName from username in CSV
          searchName = username.trim().slice(0, 3);
        }

        let finalName = searchName;
        let nameExists = await prisma.player.findUnique({
          where: { name: finalName },
        });

        if (nameExists) {
          if (nameExists.id.startsWith('guest_')) {
            // Bind the guest record to the real Discord ID and set voice time
            await prisma.player.update({
              where: { name: finalName },
              data: {
                id: userId,
                totalVoiceTime: { increment: seconds },
              },
            });
            console.log(`🔗 [CSV Import] Bound guest ${finalName} to ID ${userId} and added voice time.`);
            playerName = finalName;
            bindCount++;
          } else {
            // The name is already taken by a bound player!
            // Append a unique suffix (last 4 digits of ID) to create a unique name
            finalName = `${searchName}_${userId.slice(-4)}`;
            
            // Double check if this new mutated name is also taken
            let checkAgain = await prisma.player.findUnique({ where: { name: finalName } });
            if (checkAgain) {
              finalName = `${username.slice(0, 3)}_${userId.slice(-4)}`;
            }

            // Create new guest player in the DB
            await prisma.player.create({
              data: {
                id: userId,
                name: finalName,
                nickname: username,
                age: '20',
                currentTier: '언랭',
                highestTier: '언랭',
                wins: 0,
                losses: 0,
                mmr: 1000,
                totalVoiceTime: seconds,
              },
            });
            playerName = finalName;
            createCount++;
          }
        } else {
          // Create new guest player in the DB
          await prisma.player.create({
            data: {
              id: userId,
              name: finalName,
              nickname: username,
              age: '20',
              currentTier: '언랭',
              highestTier: '언랭',
              wins: 0,
              losses: 0,
              mmr: 1000,
              totalVoiceTime: seconds,
            },
          });
          playerName = finalName;
          createCount++;
        }
      }

      // Add to VoiceLog for all-time log tracking (Assigned to August 13, 2026)
      await prisma.voiceLog.create({
        data: {
          userId: userId,
          userName: playerName,
          channelId: 'imported',
          channelName: '이전 누적 기록 (StatBot)',
          joinTime: targetDate,
          leaveTime: new Date(targetDate.getTime() + seconds * 1000),
          duration: seconds
        }
      });
    }

    console.log(`\n🎉 CSV minutes Import Completed!`);
    console.log(`- Bound & Updated Guest Players: ${bindCount}`);
    console.log(`- Updated Existing Players: ${updateCount}`);
    console.log(`- Created New Guest Players: ${createCount}`);

  } catch (error) {
    console.error('❌ Error during import:', error);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(token);
