import express from 'express';
import { musicManager } from './musicManager.js';

export const musicRouter = express.Router();

function resolveGuildId(paramGuildId) {
  if (!paramGuildId || paramGuildId === 'default') {
    return musicManager.getDefaultGuildId();
  }
  return paramGuildId;
}

/**
 * 1. GET /api/music/:guildId/status
 * 현재 재생 중인 곡 정보, 재생 상태(재생중/일시정지, 현재 재생 시간), 전체 대기열(Queue) 배열 반환
 */
musicRouter.get('/:guildId/status', (req, res) => {
  const guildId = resolveGuildId(req.params.guildId);
  const state = musicManager.getGuildState(guildId);
  return res.json(state.toJSON());
});

/**
 * 2. POST /api/music/:guildId/add
 * 웹에서 검색어/링크를 보내면 대기열에 추가
 */
musicRouter.post('/:guildId/add', async (req, res) => {
  const guildId = resolveGuildId(req.params.guildId);
  const { query, requester = '웹 대시보드', voiceChannelId } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: '검색어 또는 링크(query)가 필요합니다.' });
  }

  try {
    const state = musicManager.getGuildState(guildId);
    const track = await musicManager.searchTrack(query.trim(), requester);

    // 봇이 아직 음성 채널에 연결되어 있지 않다면 음성 채널 탐색 후 연결
    if (!state.connection && musicManager.client) {
      const guild = await musicManager.client.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        let targetVoiceChannel = null;

        if (voiceChannelId) {
          targetVoiceChannel = await guild.channels.fetch(voiceChannelId).catch(() => null);
        } else {
          targetVoiceChannel = guild.channels.cache
            .filter((ch) => ch.isVoiceBased() && ch.members.filter((m) => !m.user.bot).size > 0)
            .sort((a, b) => b.members.size - a.members.size)
            .first();
        }

        if (targetVoiceChannel) {
          await state.connectToVoice(targetVoiceChannel);
        }
      }
    }

    state.queue.push(track);

    if (state.status === 'idle' && !state.currentTrack) {
      await state.playNext();
    } else {
      await state.syncState();
    }

    return res.json({
      success: true,
      addedTrack: track,
      state: state.toJSON(),
    });
  } catch (error) {
    console.error('Error in POST /api/music/:guildId/add:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 3. POST /api/music/:guildId/control
 * 재생/일시정지, 스킵, 정지, 볼륨 조절, 반복/셔플 토글 처리
 */
musicRouter.post('/:guildId/control', async (req, res) => {
  const guildId = resolveGuildId(req.params.guildId);
  const { action, value } = req.body;
  const state = musicManager.getGuildState(guildId);

  try {
    switch (action) {
      case 'togglePause':
        await state.togglePause();
        break;
      case 'skip':
        await state.skip();
        break;
      case 'stop':
        await state.stop(false);
        break;
      case 'disconnect':
        await state.stop(true);
        break;
      case 'loop':
        await state.cycleLoopMode();
        break;
      case 'shuffle':
        await state.shuffleQueue();
        break;
      case 'volume':
        await state.setVolume(value ?? 100);
        break;
      default:
        return res.status(400).json({ error: `지원하지 않는 action입니다: ${action}` });
    }

    return res.json({ success: true, state: state.toJSON() });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 4. PUT /api/music/:guildId/queue/reorder
 * 웹에서 드래그 앤 드롭 등으로 대기열 순서를 변경했을 때 전체 대기열 배열 순서 업데이트
 */
musicRouter.put('/:guildId/queue/reorder', async (req, res) => {
  const guildId = resolveGuildId(req.params.guildId);
  const { fromIndex, toIndex, newQueue } = req.body;
  const state = musicManager.getGuildState(guildId);

  await state.reorderQueue(fromIndex, toIndex, newQueue);
  return res.json({ success: true, state: state.toJSON() });
});

/**
 * 5. DELETE /api/music/:guildId/queue/:index
 * 대기열의 특정 곡 삭제
 */
musicRouter.delete('/:guildId/queue/:index', async (req, res) => {
  const guildId = resolveGuildId(req.params.guildId);
  const index = parseInt(req.params.index, 10);
  const state = musicManager.getGuildState(guildId);

  if (isNaN(index) || index < 0 || index >= state.queue.length) {
    return res.status(400).json({ error: '유효하지 않은 대기열 인덱스입니다.' });
  }

  await state.removeTrack(index);
  return res.json({ success: true, state: state.toJSON() });
});
