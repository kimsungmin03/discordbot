import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('내전모집')
    .setDescription('롤 내전 참가 인원을 모집합니다. (최대 10명)'),
  new SlashCommandBuilder()
    .setName('인증버튼생성')
    .setDescription('현재 채널에 유저용 가입인증 버튼이 담긴 안내 카드를 생성합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('내전등록')
    .setDescription('내전 참가를 위한 롤 소환사 정보 및 포지션을 등록/수정합니다.')
    .addStringOption(opt =>
      opt.setName('롤닉네임')
        .setDescription('롤 소환사명#태그 (예: Hide on bush#KR1)')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('주라인')
        .setDescription('가장 선호하는 주 포지션을 선택하세요.')
        .setRequired(true)
        .addChoices(
          { name: '탑 (Top)', value: '탑' },
          { name: '정글 (Jungle)', value: '정글' },
          { name: '미드 (Mid)', value: '미드' },
          { name: '원딜 (ADC)', value: '원딜' },
          { name: '서폿 (Support)', value: '서폿' },
        ))
    .addStringOption(opt =>
      opt.setName('가능라인')
        .setDescription('주라인 외에 플레이 가능한 라인을 적어주세요. (예: 정글, 원딜 / 없으면 비워두기)')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('최고티어')
        .setDescription('역대 최고 티어 (예: 다이아 2, 플레 3 / 비워두면 현재 솔랭 티어로 등록)')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('티어최신화')
    .setDescription('라이엇 API를 통해 최신 롤 닉네임 및 솔랭 티어를 갱신합니다.')
    .addStringOption(opt =>
      opt.setName('대상')
        .setDescription('갱신할 대상 (기본: 내 계정)')
        .setRequired(false)
        .addChoices(
          { name: '내 계정 갱신', value: 'me' },
          { name: '전체 유저 갱신 (관리자)', value: 'all' },
        ))
].map(command => command.toJSON());

async function deployCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    console.error('❌ Error: DISCORD_TOKEN and CLIENT_ID are required in the .env file.');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`📡 Started refreshing ${commands.length} application (/) commands...`);

    if (guildId) {
      console.log(`📍 Deploying to Guild ID: ${guildId} (Instant update)`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      console.log('✅ Successfully reloaded Guild application (/) commands.');
    } else {
      console.log('🌍 Deploying globally (Note: Global commands can take up to an hour to register across all servers).');
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      console.log('✅ Successfully reloaded global application (/) commands.');
    }
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

deployCommands();
