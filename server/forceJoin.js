import { PrismaClient } from '@prisma/client';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { updateParticipants } from './googleSheets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
const prisma = new PrismaClient();
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });

async function main() {
  console.log('🚀 Connecting to Discord...');
  await discordClient.login(process.env.DISCORD_TOKEN);

  const lobbyId = '1551554460168495171';
  const targetUserId = '381451389735272451'; // 임현진

  const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) throw new Error('Lobby not found');

  const participants = JSON.parse(lobby.participants || '[]');
  if (!participants.includes(targetUserId)) {
    participants.push(targetUserId);
  }

  // 1. Update Database
  const updatedLobby = await prisma.lobby.update({
    where: { id: lobbyId },
    data: { participants: JSON.stringify(participants) }
  });

  // 2. Resolve players from DB
  const players = await prisma.player.findMany({
    where: { id: { in: participants } }
  });
  const orderedPlayers = participants.map(id => players.find(p => p.id === id)).filter(Boolean);

  let desc = `내전에 참여하실 분들은 아래 **✋ 손들기** 버튼을 눌러주세요!\n\n`;
  desc += `**👥 참가 신청자 목록 (${orderedPlayers.length} / 10)**\n`;
  for (let i = 0; i < 10; i++) {
    if (i < orderedPlayers.length) {
      desc += `${i + 1}. <@${orderedPlayers[i].id}> (${orderedPlayers[i].name})\n`;
    } else {
      desc += `${i + 1}. 👤 *빈 자리*\n`;
    }
  }

  // 3. Update Discord Embed
  try {
    const channel = await discordClient.channels.fetch(lobby.channelId);
    const message = await channel.messages.fetch(lobbyId);
    const oldEmbed = message.embeds[0];
    const newEmbed = EmbedBuilder.from(oldEmbed).setDescription(desc);
    await message.edit({ embeds: [newEmbed] });
    console.log('✅ Discord message embed updated successfully!');
  } catch (err) {
    console.error('⚠️ Could not update Discord message:', err.message);
  }

  // 4. Update Google Sheets (C2:C11)
  const displayNames = orderedPlayers.map(p => p.name);
  await updateParticipants(displayNames);
  console.log('✅ Google Sheets participants updated!');

  console.log(`🎉 Successfully added 임현진 to lobby! Total participants: ${orderedPlayers.length} / 10`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
