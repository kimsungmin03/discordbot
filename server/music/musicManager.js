import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
} from '@discordjs/voice';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import play from 'play-dl';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.resolve(__dirname, '..', 'music-channels.json');

/**
 * 개별 디스코드 서버(Guild)의 음악 재생 상태 및 대기열을 관리하는 클래스
 */
export class GuildMusicState {
  constructor(guildId, manager) {
    this.guildId = guildId;
    this.manager = manager;

    // 고정 플레이어 채널 및 메시지 ID
    this.textChannelId = null;
    this.messageId = null;
    this.voiceChannelId = null;

    // 오디오 및 대기열 상태 (Single Source of Truth)
    this.queue = []; // [{ id, videoId, title, url, durationSec, durationFormatted, thumbnail, requester }]
    this.currentTrack = null;
    this.loopMode = 'OFF'; // 'OFF' | 'TRACK' | 'QUEUE'
    this.volume = 100; // 0 ~ 200 (%)
    this.currentResource = null;

    // @discordjs/voice AudioPlayer 생성
    this.audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });

    this.connection = null;

    // 트랙 종료(자연 종료 또는 스킵) 시 다음 곡으로 전환
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.handleTrackEnd();
    });

    this.audioPlayer.on('error', (error) => {
      console.error(`❌ [Music:${this.guildId}] AudioPlayer Error:`, error.message);
      this.handleTrackEnd();
    });
  }

  /**
   * 현재 재생 상태 문자열 반환 ('playing' | 'paused' | 'idle')
   */
  get status() {
    const state = this.audioPlayer.state.status;
    if (state === AudioPlayerStatus.Playing || state === AudioPlayerStatus.Buffering) return 'playing';
    if (state === AudioPlayerStatus.Paused || state === AudioPlayerStatus.AutoPaused) return 'paused';
    return 'idle';
  }

  /**
   * 현재 재생 경과 시간 (ms)
   */
  get playbackDurationMs() {
    if (!this.currentResource) return 0;
    return this.currentResource.playbackDuration || 0;
  }

  /**
   * 웹 API 및 WebSocket 전송용 직렬화 데이터
   */
  toJSON() {
    return {
      guildId: this.guildId,
      status: this.status,
      currentTrack: this.currentTrack,
      positionMs: this.playbackDurationMs,
      volume: this.volume,
      loopMode: this.loopMode,
      queue: this.queue,
      voiceChannelId: this.voiceChannelId,
      textChannelId: this.textChannelId,
      messageId: this.messageId,
    };
  }

  /**
   * 음성 채널 연결
   */
  async connectToVoice(voiceChannel) {
    this.voiceChannelId = voiceChannel.id;
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    this.connection.subscribe(this.audioPlayer);

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.stop(true);
      }
    });
  }

  /**
   * 곡이 끝났을 때 반복 모드에 따라 다음 트랙 처리
   */
  async handleTrackEnd() {
    const finishedTrack = this.currentTrack;
    if (finishedTrack) {
      if (this.loopMode === 'TRACK') {
        this.queue.unshift(finishedTrack);
      } else if (this.loopMode === 'QUEUE') {
        this.queue.push(finishedTrack);
      }
    }

    await this.playNext();
  }

  /**
   * 대기열의 첫 번째 곡을 꺼내 스트리밍 시작
   */
  async playNext() {
    if (this.queue.length === 0) {
      this.currentTrack = null;
      this.currentResource = null;
      await this.syncState();
      return;
    }

    this.currentTrack = this.queue.shift();

    // 봇이 연결되어 있지 않거나 테스트 모드인 경우 상태만 갱신
    if (!this.connection) {
      await this.syncState();
      return;
    }

    try {
      const stream = await play.stream(this.currentTrack.url);
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
      resource.volume.setVolume(this.volume / 100);

      this.currentResource = resource;
      this.audioPlayer.play(resource);
      await this.syncState();
    } catch (error) {
      console.error(`❌ [Music:${this.guildId}] 스트리밍 실패 (${this.currentTrack.title}):`, error.message);
      return this.playNext();
    }
  }

  /**
   * 컨트롤 액션 메서드들
   */
  async togglePause() {
    if (this.status === 'playing') {
      this.audioPlayer.pause();
    } else if (this.status === 'paused') {
      this.audioPlayer.unpause();
    }
    await this.syncState();
  }

  async skip() {
    if (!this.connection) {
      await this.playNext();
      return;
    }
    if (this.loopMode === 'TRACK' && this.currentTrack) {
      const prevLoop = this.loopMode;
      this.loopMode = 'OFF';
      this.audioPlayer.stop();
      this.loopMode = prevLoop;
    } else {
      this.audioPlayer.stop();
    }
  }

  async stop(disconnect = false) {
    this.queue = [];
    this.currentTrack = null;
    this.currentResource = null;
    this.loopMode = 'OFF';
    this.audioPlayer.stop(true);

    if (disconnect && this.connection) {
      this.connection.destroy();
      this.connection = null;
      this.voiceChannelId = null;
    }
    await this.syncState();
  }

  async cycleLoopMode() {
    const modes = ['OFF', 'QUEUE', 'TRACK'];
    const nextIdx = (modes.indexOf(this.loopMode) + 1) % modes.length;
    this.loopMode = modes[nextIdx];
    await this.syncState();
  }

  async shuffleQueue() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    await this.syncState();
  }

  async setVolume(vol) {
    this.volume = Math.max(0, Math.min(200, Number(vol)));
    if (this.currentResource && this.currentResource.volume) {
      this.currentResource.volume.setVolume(this.volume / 100);
    }
    await this.syncState();
  }

  async reorderQueue(fromIndex, toIndex, newQueueArray = null) {
    if (Array.isArray(newQueueArray)) {
      this.queue = newQueueArray;
    } else if (
      fromIndex >= 0 &&
      fromIndex < this.queue.length &&
      toIndex >= 0 &&
      toIndex < this.queue.length
    ) {
      const [moved] = this.queue.splice(fromIndex, 1);
      this.queue.splice(toIndex, 0, moved);
    }
    await this.syncState();
  }

  async removeTrack(index) {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1);
      await this.syncState();
    }
  }

  /**
   * 양방향 실시간 동기화 트리거
   * 1) Socket.io를 통해 웹 프론트엔드에 최신 상태 브로드캐스트
   * 2) 디스코드 고정형 플레이어 Embed 메시지를 edit하여 즉시 갱신
   */
  async syncState() {
    const payload = this.toJSON();

    // 1. 웹 프론트엔드 브로드캐스트
    if (this.manager.io) {
      this.manager.io.to(`music:${this.guildId}`).emit('musicStateUpdate', payload);
      this.manager.io.emit('musicStateUpdate', payload);
    }

    // 2. 디스코드 고정 플레이어 Embed 갱신
    await this.updateDiscordPlayerMessage();
  }

  /**
   * 고정 플레이어 Embed 및 5개 컨트롤 버튼 생성
   */
  buildPlayerMessagePayload() {
    const isPlaying = this.status === 'playing';
    const isPaused = this.status === 'paused';
    const loopLabels = { OFF: '꺼짐', QUEUE: '전체 반복 🔁', TRACK: '한 곡 반복 🔂' };

    const embed = new EmbedBuilder()
      .setColor(isPlaying ? '#1db954' : isPaused ? '#f1c40f' : '#c8aa6e')
      .setTitle('🎵 실시간 음악 플레이어')
      .setTimestamp();

    if (this.currentTrack) {
      embed.setDescription(
        `### [${this.currentTrack.title}](${this.currentTrack.url})\n` +
        `- **상태**: ${isPlaying ? '▶️ 재생 중' : isPaused ? '⏸️ 일시정지' : '⏹️ 대기 중'}\n` +
        `- **길이**: \`${this.currentTrack.durationFormatted}\` | **볼륨**: \`${this.volume}%\`\n` +
        `- **신청자**: ${this.currentTrack.requester} | **반복**: \`${loopLabels[this.loopMode]}\``
      );
      if (this.currentTrack.thumbnail) {
        embed.setThumbnail(this.currentTrack.thumbnail);
      }
    } else {
      embed.setDescription(
        '현재 재생 중인 곡이 없습니다.\n`/재생 [검색어/링크]` 명령어나 **웹 대시보드**에서 곡을 추가해 주세요!'
      );
    }

    const queuePreview =
      this.queue.length > 0
        ? this.queue
            .slice(0, 10)
            .map((t, idx) => `\`${idx + 1}.\` [${t.title}](${t.url}) (\`${t.durationFormatted}\`) - ${t.requester}`)
            .join('\n') + (this.queue.length > 10 ? `\n...외 **${this.queue.length - 10}**곡 대기 중` : '')
        : '*대기열이 비어 있습니다.*';

    embed.addFields({
      name: `📋 대기열 목록 (${this.queue.length}곡)`,
      value: queuePreview,
    });

    const hasActiveTrack = Boolean(this.currentTrack);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('music_pause_resume')
        .setEmoji('⏯️')
        .setLabel(isPaused ? '재개' : '일시정지')
        .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(!hasActiveTrack),
      new ButtonBuilder()
        .setCustomId('music_skip')
        .setEmoji('⏭️')
        .setLabel('스킵')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasActiveTrack),
      new ButtonBuilder()
        .setCustomId('music_stop')
        .setEmoji('⏹️')
        .setLabel('정지/초기화')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!hasActiveTrack && this.queue.length === 0),
      new ButtonBuilder()
        .setCustomId('music_loop')
        .setEmoji(this.loopMode === 'TRACK' ? '🔂' : '🔁')
        .setLabel(`반복: ${this.loopMode}`)
        .setStyle(this.loopMode !== 'OFF' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_shuffle')
        .setEmoji('🔀')
        .setLabel('셔플')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(this.queue.length < 2)
    );

    return { embeds: [embed], components: [row] };
  }

  /**
   * 저장된 Channel ID / Message ID를 찾아 디스코드 Embed를 edit
   */
  async updateDiscordPlayerMessage() {
    if (!this.manager.client || !this.textChannelId || !this.messageId) return;

    try {
      const channel = await this.manager.client.channels.fetch(this.textChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const message = await channel.messages.fetch(this.messageId).catch(() => null);
      if (!message) return;

      const payload = this.buildPlayerMessagePayload();
      await message.edit(payload);
    } catch (err) {
      console.warn(`⚠️ [Music:${this.guildId}] 플레이어 Embed 갱신 실패:`, err.message);
    }
  }
}

/**
 * 전체 서버의 GuildMusicState를 관리하는 싱글톤 매니저
 */
class MusicManager {
  constructor() {
    this.guilds = new Map(); // Map<guildId, GuildMusicState>
    this.client = null;
    this.io = null;
    this.savedConfigs = this.loadConfigs();
  }

  init(discordClient, ioInstance) {
    this.client = discordClient;
    this.io = ioInstance;

    // 저장된 고정 플레이어 채널/메시지 정보 복원
    for (const [guildId, cfg] of Object.entries(this.savedConfigs)) {
      const state = this.getGuildState(guildId);
      state.textChannelId = cfg.textChannelId;
      state.messageId = cfg.messageId;
    }
  }

  loadConfigs() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      }
    } catch (e) {
      console.error('Failed to load music-channels.json:', e.message);
    }
    return {};
  }

  savePlayerLocation(guildId, textChannelId, messageId) {
    const state = this.getGuildState(guildId);
    state.textChannelId = textChannelId;
    state.messageId = messageId;

    this.savedConfigs[guildId] = { guildId, textChannelId, messageId };
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.savedConfigs, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save music-channels.json:', e.message);
    }
  }

  getGuildState(guildId) {
    const targetGuildId = guildId || process.env.GUILD_ID || 'default';
    if (!this.guilds.has(targetGuildId)) {
      this.guilds.set(targetGuildId, new GuildMusicState(targetGuildId, this));
    }
    return this.guilds.get(targetGuildId);
  }

  /**
   * 현재 활성화된 첫 번째 Guild ID 조회 (웹 대시보드에서 guildId 미지정 시 기본값용)
   */
  getDefaultGuildId() {
    if (process.env.GUILD_ID) return process.env.GUILD_ID;
    if (this.client && this.client.guilds.cache.size > 0) {
      return this.client.guilds.cache.first().id;
    }
    const savedKeys = Object.keys(this.savedConfigs);
    if (savedKeys.length > 0) return savedKeys[0];
    return 'default';
  }

  /**
   * 유튜브 검색어 또는 URL로 음원 정보를 조회하여 표준 Track 객체로 반환
   */
  async searchTrack(query, requester = '알 수 없음') {
    let videoInfo = null;

    if (play.yt_validate(query) === 'video' && query.startsWith('http')) {
      const info = await play.video_basic_info(query);
      videoInfo = info.video_details;
    } else {
      const results = await play.search(query, { source: { youtube: 'video' }, limit: 1 });
      if (!results || results.length === 0) {
        throw new Error('검색 결과가 없습니다.');
      }
      videoInfo = results[0];
    }

    return {
      id: `${videoInfo.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      videoId: videoInfo.id,
      title: videoInfo.title || '제목 없음',
      url: videoInfo.url,
      durationSec: videoInfo.durationInSec || 0,
      durationFormatted: videoInfo.durationRaw || 'LIVE',
      thumbnail: videoInfo.thumbnails?.[0]?.url || null,
      requester,
    };
  }
}

export const musicManager = new MusicManager();
