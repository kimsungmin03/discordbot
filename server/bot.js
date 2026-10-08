import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { PrismaClient } from '@prisma/client';
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

dotenv.config({ path: getPath('.env') });

const prisma = new PrismaClient();
import cron from 'node-cron';
import { updateParticipants, syncPlayerToSheet, syncAllPlayersToSheet } from './googleSheets.js';
import { fetchFullRiotInfo, getAccountByRiotId, getAccountByPuuid, getTierByPuuid, sanitizeTier } from './riotApi.js';
let discordClient = null;
let ioInstance = null; // Socket.io server instance for broadcasting updates
const activeVoiceSessions = new Map(); // Map<userId, { joinTime, channelId, channelName }>
function isAfkChannel(channelName) {
  if (!channelName) return false;
  const lower = channelName.toLowerCase();
  return lower.includes('잠수') || lower.includes('zzzz') || lower.includes('afk');
}

function aliasUserId(id) {
  if (id === '1512734470313214013') {
    return '918864506027921438';
  }
  return id;
}

/**
 * Resolves a Discord user into a Player name, link, and updates their dummy ID to actual Discord ID.
 */
async function resolveAndBindPlayer(discordUser, guild) {
  const targetId = aliasUserId(discordUser.id);
  let displayName = discordUser.username;
  try {
    const member = await guild.members.fetch(targetId);
    displayName = member.displayName || discordUser.username;
  } catch (err) {
    // Ignore error
  }
  const searchName = displayName.trim().slice(0, 3); // 3-character real name

  // 1. Check if user already exists by Discord ID
  let player = await prisma.player.findUnique({
    where: { id: targetId }
  });

  if (player) {
    // If user's displayName changed and differs from DB name, self-heal update
    if (searchName && searchName !== player.name) {
      const conflict = await prisma.player.findUnique({ where: { name: searchName } });
      if (!conflict) {
        player = await prisma.player.update({
          where: { id: targetId },
          data: { name: searchName }
        });
        console.log(`🔄 [Self-healing] Updated player name for ID ${targetId}: -> ${searchName}`);
      }
    }
    return player;
  }

  // 2. Check if player exists by name (e.g. from Google Sheet with guest_ ID)
  player = await prisma.player.findUnique({
    where: { name: searchName }
  });

  if (player) {
    if (player.id.startsWith('guest_')) {
      player = await prisma.player.update({
        where: { name: searchName },
        data: { id: targetId }
      });
      console.log(`🔗 [Self-healing] Bound player ${searchName} to Discord ID: ${targetId}`);
    }
    return player;
  }

  // 3. Brand new player record
  try {
    player = await prisma.player.create({
      data: {
        id: targetId,
        name: searchName,
        nickname: discordUser.tag,
        age: '20', // Default dummy age
        currentTier: '언랭',
        highestTier: '언랭',
        wins: 0,
        losses: 0,
        mmr: 1000,
        maxTierSort: 26,
      }
    });
    console.log(`👤 Created guest player record: ${searchName} (${targetId})`);
  } catch (err) {
    console.error(`❌ Error creating player record:`, err.message);
    player = await prisma.player.findUnique({ where: { id: targetId } }) ||
             await prisma.player.findUnique({ where: { name: searchName } });
  }

  return player;
}

/**
 * Regenerates the Discord Embed Description based on active lobby participants and teams.
 */
async function generateEmbedDescription(lobby) {
  const participantIds = JSON.parse(lobby.participants || '[]');
  
  // Resolve players from DB
  const players = await prisma.player.findMany({
    where: { id: { in: participantIds } }
  });
  
  // Maintain the exact ordering as in participantIds
  const orderedPlayers = participantIds.map(id => players.find(p => p.id === id)).filter(Boolean);

  let desc = `내전에 참여하실 분들은 아래 **✋ 손들기** 버튼을 눌러주세요!\n\n`;
  desc += `**👥 참가 신청자 목록 (${orderedPlayers.length} / 10)**\n`;
  for (let i = 0; i < 10; i++) {
    if (i < orderedPlayers.length) {
      desc += `${i + 1}. <@${orderedPlayers[i].id}> (${orderedPlayers[i].name})\n`;
    } else {
      desc += `${i + 1}. 👤 *빈 자리*\n`;
    }
  }

  // Include team lists if teams have been assigned
  if (lobby.blueTeam && lobby.redTeam) {
    const blue = JSON.parse(lobby.blueTeam);
    const red = JSON.parse(lobby.redTeam);
    desc += `\n**🔵 1팀 (블루)**\n` + blue.map((name, i) => `${i + 1}. ${name}`).join('\n') + `\n`;
    desc += `\n**🔴 2팀 (레드)**\n` + red.map((name, i) => `${i + 1}. ${name}`).join('\n');
  }

  return desc;
}

/**
 * Broadcasts the current lobby state to all connected web interfaces via WebSockets.
 */
async function broadcastLobby(lobby) {
  if (!ioInstance || !lobby) return;
  try {
    const participantIds = JSON.parse(lobby.participants || '[]');
    const players = await prisma.player.findMany({
      where: { id: { in: participantIds } }
    });
    
    // Sort players according to index in participantIds
    const orderedPlayers = participantIds.map(id => players.find(p => p.id === id)).filter(Boolean);

    ioInstance.emit('lobbyUpdate', {
      id: lobby.id,
      channelId: lobby.channelId,
      creatorId: lobby.creatorId,
      creatorName: lobby.creatorName,
      status: lobby.status,
      timestamp: lobby.timestamp,
      blueTeam: lobby.blueTeam ? JSON.parse(lobby.blueTeam) : null,
      redTeam: lobby.redTeam ? JSON.parse(lobby.redTeam) : null,
      participants: orderedPlayers,
    });
  } catch (err) {
    console.error('Error broadcasting lobby:', err);
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Periodically or manually syncs all registered players' Riot ID and Solo Rank tier.
 * Updates MySQL Database and Google Sheets (Columns C to M only, keeping N and O formulas).
 */
export async function performWeeklyTierSync(progressCallback = null) {
  console.log('🔄 [Riot API] Starting player tier sync...');
  const players = await prisma.player.findMany();
  let successCount = 0;
  let failCount = 0;
  const updatedPlayers = [];

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    try {
      let puuid = p.puuid;
      let latestNick = p.nickname;

      // If no PUUID, try resolving from nickname if it has '#'
      if (!puuid && p.nickname && p.nickname.includes('#')) {
        try {
          const parts = p.nickname.split('#');
          const gameName = parts[0].trim();
          const tagLine = parts.slice(1).join('#').trim();
          const riotAcc = await getAccountByRiotId(gameName, tagLine);
          puuid = riotAcc.puuid;
        } catch (e) {
          // ignore error resolving puuid
        }
      }

      if (!puuid) {
        updatedPlayers.push(p);
        continue;
      }

      // Fetch latest Riot ID (in case user changed their name)
      try {
        const riotAcc = await getAccountByPuuid(puuid);
        latestNick = `${riotAcc.gameName}#${riotAcc.tagLine}`;
      } catch (err) {
        // Keep current nickname if failed
      }

      // Fetch latest solo rank tier
      const tierInfo = await getTierByPuuid(puuid);

      // Highest tier tracking
      const cleanExistingHigh = sanitizeTier(p.highestTier);
      let highestTier = cleanExistingHigh || tierInfo.currentTier || '언랭';
      let maxTierSort = p.maxTierSort || 35;
      if (tierInfo.maxTierSort < maxTierSort) {
        highestTier = tierInfo.currentTier;
        maxTierSort = tierInfo.maxTierSort;
      }


      const updated = await prisma.player.update({
        where: { id: p.id },
        data: {
          nickname: latestNick,
          puuid: puuid,
          currentTier: tierInfo.currentTier,
          highestTier: highestTier,
          maxTierSort: maxTierSort,
        }
      });

      updatedPlayers.push(updated);
      successCount++;
      if (progressCallback) {
        progressCallback(i + 1, players.length, p.name);
      }
    } catch (err) {
      console.error(`❌ [Riot API] Error syncing tier for ${p.name}:`, err.message);
      updatedPlayers.push(p);
      failCount++;
    }

    // Rate Limit Delay: 1.2s between calls
    await sleep(1200);
  }

  // Batch sync to Google Sheets (C to M only, keeping N and O formulas)
  try {
    await syncAllPlayersToSheet(updatedPlayers);
    console.log('✅ [Google Sheets] Completed batch sync to C~M columns.');
  } catch (err) {
    console.error('❌ [Google Sheets] Batch sync error:', err.message);
  }

  // Broadcast to Web Dashboard if running
  if (ioInstance) {
    try {
      const updatedLeaderboard = await prisma.player.findMany({
        orderBy: [{ mmr: 'desc' }, { wins: 'desc' }]
      });
      ioInstance.emit('leaderboardUpdate', updatedLeaderboard);
    } catch (err) {
      console.error('Error broadcasting leaderboard update:', err);
    }
  }

  console.log(`🎉 [Riot API] Sync finished! Total: ${players.length}, Success: ${successCount}, Fail: ${failCount}`);
  return { total: players.length, success: successCount, fail: failCount };
}

export async function initBot(io) {
  ioInstance = io;

  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  discordClient.once('clientReady', () => {
    console.log(`🤖 Discord Bot inside Express is ready! Logged in as ${discordClient.user.tag}`);

    // Startup Sync: cache already connected voice users
    try {
      discordClient.guilds.cache.forEach(async (guild) => {
        const channels = await guild.channels.fetch().catch(() => null);
        if (!channels) return;
        channels.forEach(channel => {
          if (channel && channel.isVoiceBased()) {
            channel.members.forEach(member => {
              if (member && member.user && !member.user.bot) {
                if (!isAfkChannel(channel.name)) {
                  const targetUserId = aliasUserId(member.id);
                  activeVoiceSessions.set(targetUserId, {
                    joinTime: new Date(),
                    channelId: channel.id,
                    channelName: channel.name
                  });
                }
              }
            });
          }
        });
      });
      console.log(`📡 [Voice State] Initialized active voice sessions on startup.`);
    } catch (error) {
      console.error('❌ [Voice State] Error caching active voice sessions on startup:', error);
    }

    // Weekly Riot Tier & Nickname Sync Scheduler (Every Monday 04:00 AM)
    cron.schedule('0 4 * * 1', async () => {
      console.log('⏰ [Cron] Triggering scheduled weekly Riot tier sync (Monday 04:00)...');
      try {
        await performWeeklyTierSync();
      } catch (err) {
        console.error('❌ [Cron] Error during scheduled weekly sync:', err);
      }
    });
    console.log('⏰ [Scheduler] Registered weekly Riot tier sync (Every Monday 04:00 AM).');
  });

  discordClient.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === '내전모집') {
        try {
          const embed = new EmbedBuilder()
            .setColor('#c8aa6e')
            .setTitle('🎮 롤 내전 모집')
            .setDescription(
              `내전에 참여하실 분들은 아래 **✋ 손들기** 버튼을 눌러주세요!\n\n` +
              `**👥 참가 신청자 목록 (0 / 10)**\n` +
              Array.from({ length: 10 }, (_, i) => `${i + 1}. 👤 *빈 자리*`).join('\n')
            )
            .setTimestamp()
            .setFooter({ text: `모집자: ${interaction.user.username} | ID: ${interaction.user.id}` });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('join_lobby')
              .setLabel('✋ 손들기')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('leave_lobby')
              .setLabel('❌ 취소')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('complete_lobby')
              .setLabel('🔒 모집 완료')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('cancel_lobby')
              .setLabel('🛑 모집 종료(쫑)')
              .setStyle(ButtonStyle.Secondary)
          );

          // Send message and get the reply object to store in Database
          const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

          // Save active lobby to Database
          const lobby = await prisma.lobby.create({
            data: {
              id: reply.id,
              channelId: interaction.channelId,
              creatorId: interaction.user.id,
              creatorName: interaction.user.username,
              status: 'OPEN',
              participants: JSON.stringify([]),
            }
          });

          // Broadcast lobby creation
          await broadcastLobby(lobby);

          // Clear Google Sheets in background
          updateParticipants([]).catch(err => {
            console.error('❌ Error clearing Google Sheets:', err);
          });

        } catch (error) {
          console.error('Error handling /내전모집 command:', error);
        }
      } else if (interaction.commandName === '인증버튼생성') {
        try {
          const embed = new EmbedBuilder()
            .setColor('#c8aa6e')
            .setTitle('✍️ 내전 서버 가입 인증')
            .setDescription(
              `안녕하세요! 내전 서버에 오신 것을 환영합니다.\n\n` +
              `원활한 매칭 진행과 전적 관리를 위해 아래 **✍️ 가입 인증하기** 버튼을 클릭하여 이름과 나이를 등록해 주세요.\n\n` +
              `* 등록 시 디스코드 서버 별명이 자동으로 **\`이름 / 년도\`** (예: \`김성민 / 03\`)로 변경되며, 전적 대시보드와 자동 바인딩됩니다.`
            )
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('verify_join')
              .setLabel('✍️ 가입 인증하기')
              .setStyle(ButtonStyle.Success)
          );

          await interaction.reply({ embeds: [embed], components: [row] });
        } catch (error) {
          console.error('Error handling /인증버튼생성 command:', error);
        }
      } else if (interaction.commandName === '내전등록') {
        try {
          await interaction.deferReply({ ephemeral: false });

          const riotId = interaction.options.getString('롤닉네임').trim();
          const mainPosition = interaction.options.getString('주라인');
          const subPositions = interaction.options.getString('가능라인') || '';
          const inputHighestTier = interaction.options.getString('최고티어')?.trim();

          // 1. Resolve registered player by Discord User ID or server nickname
          const targetUserId = aliasUserId(interaction.user.id);
          let player = await prisma.player.findUnique({
            where: { id: targetUserId }
          });

          if (!player) {
            player = await resolveAndBindPlayer(interaction.user, interaction.guild);
          }

          if (!player) {
            return interaction.editReply({
              content: '❌ 등록된 프로필 정보를 찾을 수 없습니다. 먼저 서버 가입 인증을 완료해 주세요!'
            });
          }

          // 2. Riot ID format check
          if (!riotId.includes('#')) {
            return interaction.editReply({ content: '❌ 롤 소환사명과 태그를 `#`으로 구분하여 입력해 주세요. (예: Hide on bush#KR1)' });
          }

          // 3. Riot Games API fetch
          let riotInfo;
          try {
            riotInfo = await fetchFullRiotInfo(riotId);
          } catch (riotErr) {
            return interaction.editReply({ content: `❌ 라이엇 계정 조회 실패: ${riotErr.message}` });
          }

          // 4. Calculate lane booleans
          const allPos = `${mainPosition} ${subPositions}`.toLowerCase();
          const lineTop = allPos.includes('탑') || allPos.includes('top');
          const lineJungle = allPos.includes('정글') || allPos.includes('jungle') || allPos.includes('jg');
          const lineMid = allPos.includes('미드') || allPos.includes('mid');
          const lineAd = allPos.includes('원딜') || allPos.includes('ad') || allPos.includes('adc') || allPos.includes('봇');
          const lineSupport = allPos.includes('서폿') || allPos.includes('support') || allPos.includes('sup');

          // 5. Highest tier determination: user option > existing record > current tier from API
          const cleanInputHigh = sanitizeTier(inputHighestTier);
          const cleanExistingHigh = sanitizeTier(player.highestTier);
          let highestTier = cleanInputHigh || cleanExistingHigh || riotInfo.currentTier || '언랭';
          let maxTierSort = player.maxTierSort || riotInfo.maxTierSort;


          // 6. DB Update
          const updatedPlayer = await prisma.player.update({
            where: { id: player.id },
            data: {
              nickname: riotInfo.fullName,
              puuid: riotInfo.puuid,
              currentTier: riotInfo.currentTier,
              highestTier: highestTier,
              mainPosition: mainPosition,
              lineTop,
              lineJungle,
              lineMid,
              lineAd,
              lineSupport,
              maxTierSort,
            }
          });

          // 7. Sync Google Sheets (C to M only, keeping N and O formulas)
          let sheetSynced = false;
          try {
            sheetSynced = await syncPlayerToSheet(updatedPlayer);
          } catch (sheetErr) {
            console.error('❌ Google Sheets sync error:', sheetErr);
          }

          // 8. Try ensuring '인증완료' role exists
          const member = interaction.member;
          if (member) {
            try {
              let role = interaction.guild.roles.cache.find(r => r.name === '인증완료');
              if (!role) {
                role = await interaction.guild.roles.create({
                  name: '인증완료',
                  color: '#c8aa6e',
                  reason: '가입 인증용 자동 생성 역할'
                });
              }
              await member.roles.add(role);
            } catch (err) {
              // ignore role permission error
            }
          }

          // 9. Format response Embed
          const linesList = [];
          if (lineTop) linesList.push('탑');
          if (lineJungle) linesList.push('정글');
          if (lineMid) linesList.push('미드');
          if (lineAd) linesList.push('원딜');
          if (lineSupport) linesList.push('서폿');

          const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('✅ 내전 소환사 정보 등록 완료')
            .setDescription(`**${updatedPlayer.name}** 님의 롤 계정 및 포지션 정보가 등록되었습니다.`)
            .addFields(
              { name: '👤 이름 / 나이', value: `${updatedPlayer.name} (${updatedPlayer.age}세)`, inline: true },
              { name: '🎮 롤 닉네임', value: `\`${riotInfo.fullName}\``, inline: true },
              { name: '🏆 현재 솔랭 티어', value: `${riotInfo.currentTier} (${riotInfo.lp}LP)`, inline: true },
              { name: '👑 최고 티어', value: `${updatedPlayer.highestTier}`, inline: true },
              { name: '🎯 주 포지션', value: `${mainPosition}`, inline: true },
              { name: '⚡ 플레이 가능 라인', value: linesList.length > 0 ? linesList.join(', ') : '주라인 전담', inline: true },
              { name: '📊 구글 시트 연동', value: sheetSynced ? '✅ C~M열 반영 완료' : '⚠️ 시트 동기화 보류 (DB 저장 완료)', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: '라이엇 계정 연동 및 자동 티어 최신화 활성화' });

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          console.error('Error handling /내전등록 command:', error);
          if (interaction.deferred) {
            await interaction.editReply({ content: `❌ 오류가 발생했습니다: ${error.message}` });
          }
        }
      } else if (interaction.commandName === '티어최신화') {
        try {
          await interaction.deferReply({ ephemeral: false });
          const target = interaction.options.getString('대상') || 'me';

          if (target === 'all') {
            const isAdmin = interaction.member?.permissions?.has('Administrator');
            if (!isAdmin) {
              return interaction.editReply({ content: '❌ 전체 유저 갱신은 서버 관리자만 실행할 수 있습니다.' });
            }

            await interaction.editReply({ content: '🔄 **전체 유저 롤 티어 및 닉네임 최신화를 시작합니다...**\n라이엇 API 호출 제한(Rate Limit)을 준수하기 위해 유저당 약 1.2초가 소요됩니다.' });

            performWeeklyTierSync((curr, total, name) => {
              console.log(`[Tier Sync Progress] ${curr}/${total} (${name})`);
            }).then(result => {
              interaction.followUp({
                content: `🎉 **전체 유저 티어 최신화 완료!**\n- 총 인원: ${result.total}명\n- 성공: ${result.success}명\n- 실패: ${result.fail}명\n- 구글 시트 C~M열 동기화가 완료되었습니다. (N, O열 수식 보존)`
              }).catch(console.error);
            }).catch(err => {
              interaction.followUp({ content: `❌ 전체 최신화 중 오류 발생: ${err.message}` }).catch(console.error);
            });
            return;
          }

          // Case: Single User ('me')
          const targetUserId = aliasUserId(interaction.user.id);
          let player = await prisma.player.findUnique({
            where: { id: targetUserId }
          });

          if (!player) {
            return interaction.editReply({ content: '❌ 등록된 내전 프로필이 없습니다. 먼저 `/내전등록` 명령어로 프로필을 등록해주세요!' });
          }

          let puuid = player.puuid;
          let latestNick = player.nickname;

          if (!puuid && player.nickname && player.nickname.includes('#')) {
            try {
              const parts = player.nickname.split('#');
              const acc = await getAccountByRiotId(parts[0].trim(), parts.slice(1).join('#').trim());
              puuid = acc.puuid;
            } catch (e) {}
          }

          if (!puuid) {
            return interaction.editReply({ content: `❌ 라이엇 PUUID를 찾을 수 없습니다. \`/내전등록\` 명령어로 최신 롤 닉네임(예: Hide on bush#KR1)을 다시 등록해주세요.` });
          }

          try {
            const riotAcc = await getAccountByPuuid(puuid);
            latestNick = `${riotAcc.gameName}#${riotAcc.tagLine}`;
          } catch (e) {}

          const tierInfo = await getTierByPuuid(puuid);

          const cleanExistingHigh = sanitizeTier(player.highestTier);
          let highestTier = cleanExistingHigh || tierInfo.currentTier || '언랭';
          let maxTierSort = player.maxTierSort || 35;
          if (tierInfo.maxTierSort < maxTierSort) {
            highestTier = tierInfo.currentTier;
            maxTierSort = tierInfo.maxTierSort;
          }


          const updatedPlayer = await prisma.player.update({
            where: { id: player.id },
            data: {
              nickname: latestNick,
              puuid: puuid,
              currentTier: tierInfo.currentTier,
              highestTier: highestTier,
              maxTierSort: maxTierSort,
            }
          });

          let sheetSynced = false;
          try {
            sheetSynced = await syncPlayerToSheet(updatedPlayer);
          } catch (e) {}

          const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🔄 롤 티어 최신화 완료')
            .setDescription(`**${player.name}** 님의 롤 정보가 최신화되었습니다.`)
            .addFields(
              { name: '🎮 롤 닉네임', value: `\`${updatedPlayer.nickname}\``, inline: true },
              { name: '🏆 현재 솔랭 티어', value: `${updatedPlayer.currentTier} (${tierInfo.lp}LP)`, inline: true },
              { name: '👑 최고 티어', value: `${updatedPlayer.highestTier}`, inline: true },
              { name: '📊 구글 시트 동기화', value: sheetSynced ? '✅ C~M열 최신화 완료' : '⚠️ 시트 반영 보류', inline: true }
            )
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          console.error('Error handling /티어최신화 command:', error);
          if (interaction.deferred) {
            await interaction.editReply({ content: `❌ 티어 최신화 중 오류 발생: ${error.message}` });
          }
        }
      }
    } else if (interaction.isButton()) {
      const { customId, message, user, guild } = interaction;

      if (customId === 'verify_join') {
        const modal = new ModalBuilder()
          .setCustomId('join_verify_modal')
          .setTitle('✍️ 내전 서버 가입 인증');

        const nameInput = new TextInputBuilder()
          .setCustomId('verify_name')
          .setLabel('실명 (2~4자 한글)')
          .setPlaceholder('예: 김성민')
          .setMinLength(2)
          .setMaxLength(5)
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const yearInput = new TextInputBuilder()
          .setCustomId('verify_year')
          .setLabel('태어난 년도 (뒤 2자리 또는 4자리)')
          .setPlaceholder('예: 03 또는 2003')
          .setMinLength(2)
          .setMaxLength(4)
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const firstRow = new ActionRowBuilder().addComponents(nameInput);
        const secondRow = new ActionRowBuilder().addComponents(yearInput);

        modal.addComponents(firstRow, secondRow);

        await interaction.showModal(modal);
        return;
      }

      if (
        customId !== 'join_lobby' &&
        customId !== 'leave_lobby' &&
        customId !== 'complete_lobby' &&
        customId !== 'cancel_lobby'
      ) return;

      try {
        await interaction.deferUpdate();

        const embed = message.embeds[0];
        if (!embed) return;

        // Fetch lobby from database
        let lobby = await prisma.lobby.findUnique({
          where: { id: message.id }
        });

        // Fallback: If lobby record doesn't exist (e.g. database got cleared but message remains), recreate it
        if (!lobby) {
          const footerText = embed.footer?.text || '';
          const idMatch = footerText.match(/ID:\s*(\d+)/);
          const creatorId = idMatch ? idMatch[1] : user.id;
          
          const regex = /<@!?(\d+)>/g;
          const matches = [...(embed.description || '').matchAll(regex)];
          const userIds = matches.map(match => match[1]);

          lobby = await prisma.lobby.create({
            data: {
              id: message.id,
              channelId: interaction.channelId,
              creatorId,
              creatorName: footerText.split('|')[0]?.replace('모집자:', '').trim() || user.username,
              status: 'OPEN',
              participants: JSON.stringify(userIds),
            }
          });
        }

        if (lobby.status !== 'OPEN') {
          await interaction.followUp({ content: '❌ 이미 닫힌 모집 대기열입니다.', ephemeral: true });
          return;
        }

        const targetUserId = aliasUserId(user.id);
        const userIds = JSON.parse(lobby.participants || '[]');
        const userIndex = userIds.indexOf(targetUserId);
        let updated = false;

               // 1. Handle Join Button
        if (customId === 'join_lobby') {
          if (userIndex === -1) {
            if (userIds.length >= 10) {
              await interaction.followUp({ content: '❌ 이미 정원이 찼습니다! (최대 10명)', ephemeral: true });
              return;
            }
            
            // Resolve and bind user to DB
            const player = await resolveAndBindPlayer(user, guild);

            userIds.push(targetUserId);
            updated = true;

            let displayName = user.username;
            try {
              const member = await guild.members.fetch(user.id);
              displayName = member.displayName || user.username;
            } catch (err) {}
            console.log(`🙋 [Lobby] ${displayName.trim()} (ID: ${targetUserId}) 님이 로비에 참가했습니다. (현재 ${userIds.length}명)`);
          }
        }
        // 2. Handle Leave Button
        else if (customId === 'leave_lobby') {
          if (userIndex !== -1) {
            userIds.splice(userIndex, 1);
            updated = true;

            let displayName = user.username;
            try {
              const member = await guild.members.fetch(user.id);
              displayName = member.displayName || user.username;
            } catch (err) {}
            console.log(`❌ [Lobby] ${displayName.trim()} (ID: ${targetUserId}) 님이 로비를 취소했습니다. (현재 ${userIds.length}명)`);
          }
        }
        // 3. Handle Complete Button
        else if (customId === 'complete_lobby') {
          const isCreator = targetUserId === lobby.creatorId;
          const isAdmin = interaction.member?.permissions?.has('Administrator');
          if (!isCreator && !isAdmin) {
            await interaction.followUp({ content: '❌ 모집을 등록한 사람이나 관리자만 완료할 수 있습니다.', ephemeral: true });
            return;
          }

          // Disable buttons
          const disabledComponents = message.components.map(row => {
            const newRow = new ActionRowBuilder();
            row.components.forEach(comp => {
              const btn = ButtonBuilder.from(comp.toJSON());
              btn.setDisabled(true);
              newRow.addComponents(btn);
            });
            return newRow;
          });

          // Update DB Status
          lobby = await prisma.lobby.update({
            where: { id: message.id },
            data: { status: 'COMPLETED' }
          });

          const desc = (await generateEmbedDescription(lobby)) + `\n\n🔒 **모집이 완료되어 대기열이 닫혔습니다.**`;
          const newEmbed = EmbedBuilder.from(embed).setColor('#7f8c8d').setDescription(desc);

          await interaction.editReply({ embeds: [newEmbed], components: disabledComponents });
          await interaction.followUp({ content: '🔒 내전 모집이 완료되었습니다. 대기열이 잠겼습니다.' });
          
          await broadcastLobby(lobby);
          return;
        }
        // 4. Handle Cancel Button (쫑)
        else if (customId === 'cancel_lobby') {
          const isCreator = targetUserId === lobby.creatorId;
          const isAdmin = interaction.member?.permissions?.has('Administrator');
          if (!isCreator && !isAdmin) {
            await interaction.followUp({ content: '❌ 모집을 등록한 사람이나 관리자만 취소할 수 있습니다.', ephemeral: true });
            return;
          }

          // Disable buttons
          const disabledComponents = message.components.map(row => {
            const newRow = new ActionRowBuilder();
            row.components.forEach(comp => {
              const btn = ButtonBuilder.from(comp.toJSON());
              btn.setDisabled(true);
              newRow.addComponents(btn);
            });
            return newRow;
          });

          // Update DB Status
          lobby = await prisma.lobby.update({
            where: { id: message.id },
            data: { status: 'CANCELLED', blueTeam: null, redTeam: null }
          });

          const desc = (await generateEmbedDescription(lobby)) + `\n\n🛑 **내전 모집이 종료(취소)되었습니다.**`;
          const newEmbed = EmbedBuilder.from(embed).setColor('#e74c3c').setDescription(desc);

          await interaction.editReply({ embeds: [newEmbed], components: disabledComponents });
          await interaction.followUp({ content: '🛑 내전 모집이 취소되었습니다.' });
          
          await broadcastLobby(lobby);

          // Clear Google Sheets in background (lobby only)
          updateParticipants([]).catch(err => {
            console.error('❌ Error clearing Google Sheets:', err);
          });

          return;
        }

        // Re-save changed lobby user list
        if (updated) {
          // If roster changed, clear any previous team splits
          lobby = await prisma.lobby.update({
            where: { id: message.id },
            data: {
              participants: JSON.stringify(userIds),
              blueTeam: null,
              redTeam: null
            }
          });

          // Update Discord Embed
          const desc = await generateEmbedDescription(lobby);
          const newEmbed = EmbedBuilder.from(embed).setDescription(desc);
          await interaction.editReply({ embeds: [newEmbed] });

          // Broadcast state to web client
          await broadcastLobby(lobby);

          // Update Google Sheets in the background
          const displayNames = [];
          for (const id of userIds) {
            let displayName = '';
            try {
              const member = await guild.members.fetch(id);
              displayName = member.displayName || member.user.username;
            } catch (err) {
              try {
                const u = await interaction.client.users.fetch(id);
                displayName = u.username;
              } catch {
                displayName = `User_${id}`;
              }
            }
            // Take only the first 3 characters
            displayNames.push(displayName.trim().slice(0, 3));
          }

          // Run sheets update asynchronously
          updateParticipants(displayNames).catch(err => {
            console.error('❌ Error updating Google Sheets in background:', err);
          });

          if (customId === 'join_lobby' && userIds.length === 10) {
            await interaction.followUp({ content: '🎉 내전 인원 10명이 모두 모였습니다! 경기를 준비해 주세요! (구글 시트 연동 완료)' });
          }
        }
      } catch (error) {
        console.error('Error handling button interaction:', error);
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'join_verify_modal') {
        const { guild, member } = interaction;
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.fields.getTextInputValue('verify_name').trim();
        const yearInput = interaction.fields.getTextInputValue('verify_year').trim();

        // 1. Validation
        const koreanRegex = /^[가-힣a-zA-Z\s]{2,5}$/;
        if (!koreanRegex.test(name)) {
          return interaction.editReply({ content: '❌ 올바르지 않은 이름 형식입니다. 한글 또는 영문 2~5자만 사용 가능합니다.' });
        }

        const year2digit = yearInput.slice(-2);
        const parsedYear = parseInt(year2digit);
        if (isNaN(parsedYear) || yearInput.length < 2) {
          return interaction.editReply({ content: '❌ 올바르지 않은 태어난 년도 형식입니다. 03 또는 2003과 같이 입력해주세요.' });
        }

        // Age calculation
        const fullYear = parsedYear >= 30 ? 1900 + parsedYear : 2000 + parsedYear;
        const currentYear = new Date().getFullYear();
        const calculatedAge = currentYear - fullYear;

        try {
          const newNickname = `${name} / ${year2digit}`;

          // Try to update user nickname in Discord
          let nickUpdated = false;
          try {
            await member.setNickname(newNickname);
            nickUpdated = true;
          } catch (err) {
            console.warn(`Could not set nickname for ${member.user.tag}:`, err.message);
          }

          // Find or create "인증완료" role and assign it to member
          let roleAssigned = false;
          const roleName = '인증완료';
          try {
            let role = guild.roles.cache.find(r => r.name === roleName);
            if (!role) {
              role = await guild.roles.create({
                name: roleName,
                color: '#c8aa6e',
                reason: '가입 인증용 자동 생성 역할'
              });
              console.log(`🆕 Created missing role "${roleName}"`);
            }
            await member.roles.add(role);
            roleAssigned = true;
          } catch (err) {
            console.error(`❌ Failed to assign/create role "${roleName}":`, err.message);
          }

          // 2. Database Self-healing Binding
          const searchName = name.slice(0, 3);
          let finalName = searchName;
          
          const targetUserId = aliasUserId(member.id);
          
          // Check if the user (by Discord ID) already exists in the database
          let playerById = await prisma.player.findUnique({
            where: { id: targetUserId }
          });

          let bindMessage = '';

          if (playerById) {
            // Member already exists by Discord ID!
            // Just update their age
            await prisma.player.update({
              where: { id: targetUserId },
              data: {
                age: calculatedAge.toString()
              }
            });
            bindMessage = `\n✨ 이미 연동된 정보의 나이(${calculatedAge}세)를 갱신했습니다.`;
          } else {
            // New Discord ID (either a new user or a secondary account)
            // Let's see if the base name is available or if we can bind to a guest
            let namePlayer = await prisma.player.findUnique({
              where: { name: searchName }
            });

            if (namePlayer && namePlayer.id.startsWith('guest_')) {
              // A guest record exists with this exact name, bind it!
              await prisma.player.update({
                where: { name: searchName },
                data: {
                  id: targetUserId,
                  age: calculatedAge.toString()
                }
              });
              bindMessage = `\n🔗 기존 구글 시트의 소환사 정보(이름: ${searchName})가 귀하의 디스코드 계정과 연동되었습니다.`;
            } else {
              // The name is either already bound to another active Discord ID, or doesn't exist.
              // We will generate a unique name (e.g. 김성민_2) to avoid unique constraint error.
              let suffix = 2;
              while (true) {
                const existing = await prisma.player.findUnique({ where: { name: finalName } });
                if (!existing) break;
                finalName = `${searchName}_${suffix}`;
                suffix++;
              }

              // Create new player profile
              await prisma.player.create({
                data: {
                  id: targetUserId,
                  name: finalName,
                  nickname: interaction.user.tag,
                  age: calculatedAge.toString(),
                  currentTier: '언랭',
                  highestTier: '언랭',
                  wins: 0,
                  losses: 0,
                  mmr: 1000
                }
              });

              if (finalName === searchName) {
                bindMessage = `\n🆕 신규 내전 소환사 프로필이 생성되었습니다. (언랭, MMR 1000)`;
              } else {
                bindMessage = `\n🆕 기존에 등록된 동일한 이름이 있어, DB에는 \`${finalName}\`(으)로 구분 등록되었습니다.`;
              }
            }
          }

          if (ioInstance) {
            const updatedLeaderboard = await prisma.player.findMany({
              orderBy: [
                { mmr: 'desc' },
                { wins: 'desc' }
              ]
            });
            ioInstance.emit('leaderboardUpdate', updatedLeaderboard);
          }

          let responseText = `✅ **가입 인증에 성공했습니다!**\n- 별명 변경: \`${newNickname}\`${nickUpdated ? '' : ' (⚠️ 서버 관리자/소유자 권한 한계로 별명을 변경할 수 없었습니다. 수동으로 변경해주세요.)'}\n- 역할 부여: ${roleAssigned ? `\`${roleName}\` 역할이 부여되었습니다.` : '⚠️ 역할 부여 실패 (봇 권한을 확인해주세요.)'}${bindMessage}`;
          await interaction.editReply({ content: responseText });

        } catch (error) {
          console.error('Error in Modal submit verify interaction:', error);
          await interaction.editReply({ content: '❌ 인증 처리 도중 시스템 에러가 발생했습니다. 관리자에게 문의하세요.' });
        }
      }
    }
  });

  discordClient.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const targetUserId = aliasUserId(member.id);

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // Case 1: Joined a voice channel
    if (!oldChannelId && newChannelId) {
      const channel = newState.channel;
      if (channel && !isAfkChannel(channel.name)) {
        activeVoiceSessions.set(targetUserId, {
          joinTime: new Date(),
          channelId: channel.id,
          channelName: channel.name
        });
        console.log(`🎙️ [Voice Log] ${member.displayName} joined channel ${channel.name}`);
      }
    }
    // Case 2: Left a voice channel
    else if (oldChannelId && !newChannelId) {
      const session = activeVoiceSessions.get(targetUserId);
      if (session) {
        activeVoiceSessions.delete(targetUserId);
        const duration = Math.round((new Date() - session.joinTime) / 1000);
        if (duration > 0) {
          try {
            // Ensure player exists (upsert/bind)
            const player = await resolveAndBindPlayer(member.user, oldState.guild);
            if (player) {
              await prisma.player.update({
                where: { id: player.id },
                data: {
                  totalVoiceTime: { increment: duration }
                }
              });

              // Broadcast updated player list to WebSockets
              if (ioInstance) {
                const updatedLeaderboard = await prisma.player.findMany({
                  orderBy: [
                    { mmr: 'desc' },
                    { wins: 'desc' }
                  ]
                });
                ioInstance.emit('leaderboardUpdate', updatedLeaderboard);
              }
            }

            await prisma.voiceLog.create({
              data: {
                userId: targetUserId,
                userName: player ? player.name : member.displayName || member.user.username,
                channelId: session.channelId,
                channelName: session.channelName || 'Unknown Channel',
                joinTime: session.joinTime,
                leaveTime: new Date(),
                duration: duration
              }
            });
            console.log(`🎙️ [Voice Log] ${member.displayName} left channel ${session.channelName} (Duration: ${duration}s)`);
          } catch (err) {
            console.error('Error logging voice state leave:', err);
          }
        }
      }
    }
    // Case 3: Switched voice channels
    else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      const session = activeVoiceSessions.get(targetUserId);
      const leaveTime = new Date();
      const newChannel = newState.channel;

      if (session) {
        activeVoiceSessions.delete(targetUserId);
        const duration = Math.round((leaveTime - session.joinTime) / 1000);
        if (duration > 0) {
          try {
            const player = await resolveAndBindPlayer(member.user, oldState.guild);
            if (player) {
              await prisma.player.update({
                where: { id: player.id },
                data: {
                  totalVoiceTime: { increment: duration }
                }
              });

              // Broadcast updated player list to WebSockets
              if (ioInstance) {
                const updatedLeaderboard = await prisma.player.findMany({
                  orderBy: [
                    { mmr: 'desc' },
                    { wins: 'desc' }
                  ]
                });
                ioInstance.emit('leaderboardUpdate', updatedLeaderboard);
              }
            }

            await prisma.voiceLog.create({
              data: {
                userId: targetUserId,
                userName: player ? player.name : member.displayName || member.user.username,
                channelId: session.channelId,
                channelName: session.channelName || 'Unknown Channel',
                joinTime: session.joinTime,
                leaveTime: leaveTime,
                duration: duration
              }
            });
            console.log(`🎙️ [Voice Log] ${member.displayName} switched from ${session.channelName} to ${newChannel?.name} (Logged: ${duration}s)`);
          } catch (err) {
            console.error('Error logging voice state switch:', err);
          }
        }
      }

      // Start new session
      if (newChannel && !isAfkChannel(newChannel.name)) {
        activeVoiceSessions.set(targetUserId, {
          joinTime: leaveTime,
          channelId: newChannel.id,
          channelName: newChannel.name
        });
      }
    }
  });

  const token = process.env.DISCORD_TOKEN;
  if (!token || token === 'your_discord_bot_token_here') {
    console.error('❌ Error: DISCORD_TOKEN is missing or not set in the .env file.');
    process.exit(1);
  }

  await discordClient.login(token);
}
