import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import dotenv from 'dotenv';
import { updateParticipants } from './googleSheets.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

// Cache to prevent race conditions during rapid button clicks.
// Map<messageId, userIds[]>
const lobbyCache = new Map();

function getParticipantsFromEmbed(embed) {
  if (!embed || !embed.description) return [];
  const regex = /<@!?(\d+)>/g;
  const matches = [...embed.description.matchAll(regex)];
  // We only want the first 10 matches (since team players are also in the description as text and could be matched,
  // but the participant list is under '참가 신청자 목록 (N / 10)' which comes first).
  // Actually, wait! The regex /<@!?(\d+)>/g matches user mentions like <@12345678>.
  // The team player lists are written as text names (e.g. "1. 페이커"), NOT as mentions!
  // So the regex will ONLY match the player mentions in the participant list!
  // This is a major design benefit!Mentions are only used in the 1~10 participant list, while team names are raw text.
  // So getParticipantsFromEmbed will only match the participant mentions, even if teams are displayed.
  return matches.map(match => match[1]);
}

/**
 * Gets the current participants list for a message, either from memory cache
 * or by parsing the embed description (restoring state on bot restart).
 */
function getParticipants(message) {
  if (lobbyCache.has(message.id)) {
    return lobbyCache.get(message.id);
  }

  const embed = message.embeds[0];
  const userIds = getParticipantsFromEmbed(embed);
  
  // Save to cache
  lobbyCache.set(message.id, userIds);
  
  // Simple cache eviction to prevent memory leak
  if (lobbyCache.size > 100) {
    const firstKey = lobbyCache.keys().next().value;
    lobbyCache.delete(firstKey);
  }

  return userIds;
}

client.once('clientReady', () => {
  console.log(`🤖 Bot is ready! Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === '내전모집') {
      try {
        const embed = new EmbedBuilder()
          .setColor('#c8aa6e') // League of Legends Hextech Gold
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

        await interaction.reply({ embeds: [embed], components: [row] });
      } catch (error) {
        console.error('Error handling /내전모집 command:', error);
      }
    }
  } else if (interaction.isButton()) {
    const { customId, message, user, guild } = interaction;

    if (
      customId !== 'join_lobby' &&
      customId !== 'leave_lobby' &&
      customId !== 'complete_lobby' &&
      customId !== 'cancel_lobby'
    ) return;

    try {
      // Defer the interaction immediately to prevent timeouts
      await interaction.deferUpdate();

      const embed = message.embeds[0];
      if (!embed) return;

      // Extract creator ID from the footer
      const footerText = embed.footer?.text || '';
      const idMatch = footerText.match(/ID:\s*(\d+)/);
      const creatorId = idMatch ? idMatch[1] : null;

      // Handle complete_lobby (모집 완료)
      if (customId === 'complete_lobby') {
        const isCreator = user.id === creatorId;
        const isAdmin = interaction.member?.permissions?.has('Administrator');
        if (!isCreator && !isAdmin) {
          await interaction.followUp({ content: '❌ 모집을 등록한 사람이나 관리자만 모집을 완료할 수 있습니다.', ephemeral: true });
          return;
        }

        // Disable all buttons
        const disabledComponents = message.components.map(row => {
          const newRow = new ActionRowBuilder();
          row.components.forEach(comp => {
            const btn = ButtonBuilder.from(comp.toJSON());
            btn.setDisabled(true);
            newRow.addComponents(btn);
          });
          return newRow;
        });

        // Update Embed
        let desc = embed.description || '';
        desc += `\n\n🔒 **모집이 완료되어 대기열이 닫혔습니다.**`;
        const newEmbed = EmbedBuilder.from(embed)
          .setColor('#7f8c8d') // Gray
          .setDescription(desc);

        await interaction.editReply({ embeds: [newEmbed], components: disabledComponents });
        await interaction.followUp({ content: '🔒 내전 모집이 완료되었습니다. 대기열이 잠겼습니다.' });
        return;
      }

      // Handle cancel_lobby (모집 종료/쫑)
      if (customId === 'cancel_lobby') {
        const isCreator = user.id === creatorId;
        const isAdmin = interaction.member?.permissions?.has('Administrator');
        if (!isCreator && !isAdmin) {
          await interaction.followUp({ content: '❌ 모집을 등록한 사람이나 관리자만 모집을 종료할 수 있습니다.', ephemeral: true });
          return;
        }

        // Disable all buttons
        const disabledComponents = message.components.map(row => {
          const newRow = new ActionRowBuilder();
          row.components.forEach(comp => {
            const btn = ButtonBuilder.from(comp.toJSON());
            btn.setDisabled(true);
            newRow.addComponents(btn);
          });
          return newRow;
        });

        // Update Embed
        let desc = embed.description || '';
        desc += `\n\n🛑 **내전 모집이 종료(취소)되었습니다.**`;
        const newEmbed = EmbedBuilder.from(embed)
          .setColor('#e74c3c') // Red
          .setDescription(desc);

        await interaction.editReply({ embeds: [newEmbed], components: disabledComponents });

        // Clear Google Sheets in background (lobby only)
        updateParticipants([]).catch(err => {
          console.error('❌ Error clearing Google Sheets:', err);
        });

        await interaction.followUp({ content: '🛑 내전 모집이 종료되었습니다. 구글 시트 명단이 초기화되었습니다.' });
        return;
      }

      // Handle join/leave lobby
      const userIds = [...getParticipants(message)];
      const userIndex = userIds.indexOf(user.id);
      let updated = false;

            if (customId === 'join_lobby') {
        if (userIndex === -1) {
          if (userIds.length >= 10) {
            // Lobby full warning (ephemeral)
            await interaction.followUp({ content: '❌ 이미 정원이 찼습니다! (최대 10명)', ephemeral: true });
            return;
          }
          userIds.push(user.id);
          updated = true;

          let displayName = user.username;
          try {
            const member = await guild.members.fetch(user.id);
            displayName = member.displayName || user.username;
          } catch (err) {}
          console.log(`🙋 [Lobby] ${displayName.trim()} (ID: ${user.id}) 님이 로비에 참가했습니다. (현재 ${userIds.length}명)`);
        }
      } else if (customId === 'leave_lobby') {
        if (userIndex !== -1) {
          userIds.splice(userIndex, 1);
          updated = true;

          let displayName = user.username;
          try {
            const member = await guild.members.fetch(user.id);
            displayName = member.displayName || user.username;
          } catch (err) {}
          console.log(`❌ [Lobby] ${displayName.trim()} (ID: ${user.id}) 님이 로비를 취소했습니다. (현재 ${userIds.length}명)`);
        }
      }

      if (updated) {
        // Save to cache
        lobbyCache.set(message.id, userIds);

        // Update Discord UI immediately (resets description, clearing any active team allocation text)
        let desc = `내전에 참여하실 분들은 아래 **✋ 손들기** 버튼을 눌러주세요!\n\n`;
        desc += `**👥 참가 신청자 목록 (${userIds.length} / 10)**\n`;
        for (let i = 0; i < 10; i++) {
          if (i < userIds.length) {
            desc += `${i + 1}. <@${userIds[i]}>\n`;
          } else {
            desc += `${i + 1}. 👤 *빈 자리*\n`;
          }
        }

        const newEmbed = EmbedBuilder.from(embed).setDescription(desc);
        await interaction.editReply({ embeds: [newEmbed] });

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

        // If the lobby became full (10 players), notify the channel
        if (customId === 'join_lobby' && userIds.length === 10) {
          await interaction.followUp({ content: '🎉 내전 인원 10명이 모두 모였습니다! 경기를 준비해 주세요! (구글 시트 연동 완료)' });
        }
      }
    } catch (error) {
      console.error('Error handling button interaction:', error);
    }
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token || token === 'your_discord_bot_token_here') {
  console.error('❌ Error: DISCORD_TOKEN is missing or not set in the .env file.');
  process.exit(1);
}

client.login(token).catch(err => {
  console.error('❌ Failed to login to Discord:', err.message);
});
