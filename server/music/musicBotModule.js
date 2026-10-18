import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { musicManager } from './musicManager.js';

/**
 * deploy-commands.js에 등록할 음악 슬래시 명령어 정의
 */
export const musicSlashCommands = [
  new SlashCommandBuilder()
    .setName('음악세팅')
    .setDescription('현재 채널에 고정될 음악 플레이어 Embed와 컨트롤 버튼을 생성합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('재생')
    .setDescription('유튜브에서 음원을 검색해 대기열에 추가하고 재생합니다.')
    .addStringOption((opt) =>
      opt
        .setName('검색어')
        .setDescription('유튜브 검색어 또는 영상 링크(URL)')
        .setRequired(true)
    ),
];

/**
 * server/bot.js의 interactionCreate 이벤트 내부에서 호출할 핸들러
 * @returns {Promise<boolean>} 음악 관련 인터랙션을 처리했으면 true 반환
 */
export async function handleMusicInteraction(interaction) {
  const { guildId, member, channel } = interaction;
  if (!guildId) return false;

  const state = musicManager.getGuildState(guildId);

  // 1. 슬래시 명령어 처리 (/음악세팅, /재생)
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === '음악세팅') {
      await interaction.deferReply({ ephemeral: true });

      const payload = state.buildPlayerMessagePayload();
      const playerMessage = await channel.send(payload);

      // Guild ID, Channel ID, Message ID 영구 저장
      musicManager.savePlayerLocation(guildId, channel.id, playerMessage.id);

      await interaction.editReply({
        content: `✅ 이 채널(<#${channel.id}>)에 고정 음악 플레이어가 세팅되었습니다. (Message ID: \`${playerMessage.id}\`)`,
      });
      return true;
    }

    if (interaction.commandName === '재생') {
      const query = interaction.options.getString('검색어', true);
      const voiceChannel = member?.voice?.channel;

      if (!voiceChannel) {
        await interaction.reply({
          content: '❌ 먼저 음성 채널에 입장한 상태에서 `/재생` 명령어를 사용해 주세요!',
          ephemeral: true,
        });
        return true;
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const requesterName = member.displayName || interaction.user.username;
        const track = await musicManager.searchTrack(query, requesterName);

        // 봇이 음성 채널에 없거나 다른 채널에 있다면 접속
        if (!state.connection || state.voiceChannelId !== voiceChannel.id) {
          await state.connectToVoice(voiceChannel);
        }

        state.queue.push(track);

        // 재생 중이 아니면 즉시 재생 시작, 재생 중이면 대기열 추가 후 동기화
        if (state.status === 'idle') {
          await state.playNext();
        } else {
          await state.syncState();
        }

        await interaction.editReply({
          content: `🎵 **[${track.title}](${track.url})** (\`${track.durationFormatted}\`) 곡이 대기열에 추가되었습니다!`,
        });
      } catch (error) {
        await interaction.editReply({
          content: `❌ 음원을 추가할 수 없습니다: ${error.message}`,
        });
      }
      return true;
    }
  }

  // 2. 고정 플레이어 하단 5개 버튼 컨트롤러 처리
  if (interaction.isButton()) {
    const { customId } = interaction;
    const musicButtonIds = [
      'music_pause_resume',
      'music_skip',
      'music_stop',
      'music_loop',
      'music_shuffle',
    ];

    if (!musicButtonIds.includes(customId)) return false;

    // 별도 텍스트 응답 없이 즉시 업데이트 수락 (deferUpdate)
    await interaction.deferUpdate();

    switch (customId) {
      case 'music_pause_resume':
        await state.togglePause();
        break;
      case 'music_skip':
        await state.skip();
        break;
      case 'music_stop':
        await state.stop(false);
        break;
      case 'music_loop':
        await state.cycleLoopMode();
        break;
      case 'music_shuffle':
        await state.shuffleQueue();
        break;
    }
    return true;
  }

  return false;
}
