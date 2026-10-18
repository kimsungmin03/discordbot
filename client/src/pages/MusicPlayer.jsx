import React, { useState, useEffect, useRef } from 'react';

export default function MusicPlayer({ socket, guildId = 'default' }) {
  const [musicState, setMusicState] = useState({
    guildId: 'default',
    status: 'idle',
    currentTrack: null,
    positionMs: 0,
    volume: 100,
    loopMode: 'OFF',
    queue: [],
  });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [localProgressSec, setLocalProgressSec] = useState(0);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const dragItemIndex = useRef(null);

  // 초기 상태 조회 및 실시간 소켓 이벤트 수신
  useEffect(() => {
    fetch(`/api/music/${guildId}/status`)
      .then((res) => res.json())
      .then((data) => {
        setMusicState(data);
        setLocalProgressSec(Math.floor((data.positionMs || 0) / 1000));
        if (socket && data.guildId) {
          socket.emit('joinMusicGuild', data.guildId);
        }
      })
      .catch((err) => console.error('Failed to fetch music status:', err));

    if (!socket) return;

    const handleStateUpdate = (updatedState) => {
      setMusicState(updatedState);
      setLocalProgressSec(Math.floor((updatedState.positionMs || 0) / 1000));
    };

    socket.on('musicStateUpdate', handleStateUpdate);
    return () => {
      socket.off('musicStateUpdate', handleStateUpdate);
    };
  }, [guildId, socket]);

  // 재생 중일 때 1초마다 경과 시간 업데이트
  useEffect(() => {
    if (musicState.status !== 'playing') return;
    const timer = setInterval(() => {
      setLocalProgressSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [musicState.status]);

  const targetGuild = musicState.guildId || guildId;

  // 음원 추가 (POST /api/music/:guildId/add)
  const handleAddTrack = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/music/${targetGuild}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, requester: '웹 대시보드' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '곡 추가 실패');
      setQuery('');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 재생 컨트롤 (POST /api/music/:guildId/control)
  const sendControl = async (action, value = undefined) => {
    try {
      await fetch(`/api/music/${targetGuild}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });
    } catch (err) {
      console.error('Control error:', err);
    }
  };

  // 드래그 앤 드롭 대기열 순서 변경 (PUT /api/music/:guildId/queue/reorder)
  const handleDrop = async (dropIndex) => {
    const fromIndex = dragItemIndex.current;
    dragItemIndex.current = null;
    setDragOverIdx(null);

    if (fromIndex === null || fromIndex === dropIndex) return;

    const updatedQueue = [...musicState.queue];
    const [moved] = updatedQueue.splice(fromIndex, 1);
    updatedQueue.splice(dropIndex, 0, moved);
    setMusicState((prev) => ({ ...prev, queue: updatedQueue }));

    try {
      await fetch(`/api/music/${targetGuild}/queue/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromIndex, toIndex: dropIndex }),
      });
    } catch (err) {
      console.error('Reorder failed:', err);
    }
  };

  // 대기열 곡 삭제 (DELETE /api/music/:guildId/queue/:index)
  const handleRemoveTrack = async (index) => {
    try {
      await fetch(`/api/music/${targetGuild}/queue/${index}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Delete track failed:', err);
    }
  };

  const formatSec = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const { currentTrack, status, volume, loopMode, queue } = musicState;
  const loopLabelMap = { OFF: '반복 꺼짐', QUEUE: '전체 반복 🔁', TRACK: '한 곡 반복 🔂' };

  return (
    <div className="page-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="section-header" style={{ marginBottom: '20px' }}>
        <h2>🎵 실시간 음악 플레이어 & 대기열 제어</h2>
        <p style={{ color: '#949ba4', fontSize: '0.9rem', marginTop: '4px' }}>
          디스코드 고정 플레이어와 웹 대시보드가 실시간으로 양방향 동기화됩니다.
        </p>
      </div>

      {/* 검색 및 곡 추가 폼 */}
      <form
        onSubmit={handleAddTrack}
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '24px',
          background: 'rgba(15, 23, 42, 0.7)',
          padding: '14px',
          borderRadius: '10px',
          border: '1px solid rgba(200, 170, 110, 0.25)',
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="유튜브 검색어 또는 영상 링크(URL)를 입력하세요..."
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: '#090d16',
            color: '#f0e6d2',
            fontSize: '0.95rem',
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0 22px',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #c8aa6e, #937341)',
            color: '#090d16',
            fontWeight: '700',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '검색 중...' : '➕ 대기열 추가'}
        </button>
      </form>

      {/* 현재 재생 카드 & 5개 컨트롤 버튼 */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(200, 170, 110, 0.35)',
          borderRadius: '12px',
          padding: '22px',
          marginBottom: '24px',
        }}
      >
        {currentTrack ? (
          <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
            {currentTrack.thumbnail && (
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                style={{ width: '140px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
              />
            )}
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    background: status === 'playing' ? '#1db954' : '#f1c40f',
                    color: '#000',
                  }}
                >
                  {status === 'playing' ? '▶️ PLAYING' : '⏸️ PAUSED'}
                </span>
                <span style={{ color: '#949ba4', fontSize: '0.85rem' }}>
                  신청자: {currentTrack.requester}
                </span>
              </div>
              <a
                href={currentTrack.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#f0e6d2', fontSize: '1.1rem', fontWeight: '700', textDecoration: 'none' }}
              >
                {currentTrack.title}
              </a>
              <div style={{ marginTop: '8px', color: '#c8aa6e', fontSize: '0.9rem', fontWeight: '600' }}>
                ⏱️ {formatSec(localProgressSec)} / {currentTrack.durationFormatted}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#949ba4' }}>
            현재 재생 중인 곡이 없습니다. 위 검색창이나 디스코드 <code>/재생</code> 명령어로 음악을 추가해 보세요!
          </div>
        )}

        {/* 하단 컨트롤 바 */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => sendControl('togglePause')}
            disabled={!currentTrack}
            style={ctrlBtnStyle(!currentTrack, status === 'paused' ? '#2ecc71' : '#3b82f6')}
          >
            ⏯️ {status === 'paused' ? '재개' : '일시정지'}
          </button>
          <button
            onClick={() => sendControl('skip')}
            disabled={!currentTrack}
            style={ctrlBtnStyle(!currentTrack)}
          >
            ⏭️ 스킵
          </button>
          <button
            onClick={() => sendControl('stop')}
            disabled={!currentTrack && queue.length === 0}
            style={ctrlBtnStyle(!currentTrack && queue.length === 0, '#ef4444')}
          >
            ⏹️ 정지/초기화
          </button>
          <button
            onClick={() => sendControl('loop')}
            style={ctrlBtnStyle(false, loopMode !== 'OFF' ? '#10b981' : '#334155')}
          >
            {loopLabelMap[loopMode] || `🔁 반복: ${loopMode}`}
          </button>
          <button
            onClick={() => sendControl('shuffle')}
            disabled={queue.length < 2}
            style={ctrlBtnStyle(queue.length < 2)}
          >
            🔀 셔플
          </button>

          {/* 볼륨 조절 */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#cbd5e1', minWidth: '65px' }}>🔊 {volume}%</span>
            <input
              type="range"
              min="0"
              max="200"
              value={volume}
              onChange={(e) => sendControl('volume', Number(e.target.value))}
              style={{ cursor: 'pointer', accentColor: '#c8aa6e' }}
            />
          </div>
        </div>
      </div>

      {/* 대기열 목록 (드래그 앤 드롭 지원) */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, color: '#f0e6d2' }}>📋 대기열 목록 ({queue.length}곡)</h3>
          <span style={{ fontSize: '0.8rem', color: '#949ba4' }}>
            💡 항목을 드래그하여 재생 순서를 변경할 수 있습니다
          </span>
        </div>

        {queue.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#64748b' }}>
            대기열이 비어 있습니다.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {queue.map((track, idx) => (
              <li
                key={track.id || idx}
                draggable
                onDragStart={() => (dragItemIndex.current = idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIdx(idx);
                }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={() => handleDrop(idx)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: dragOverIdx === idx ? 'rgba(200, 170, 110, 0.2)' : 'rgba(9, 13, 22, 0.8)',
                  border:
                    dragOverIdx === idx
                      ? '1px dashed #c8aa6e'
                      : '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '8px',
                  cursor: 'grab',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                  <span style={{ color: '#64748b', cursor: 'grab' }}>☰</span>
                  <strong style={{ color: '#c8aa6e', minWidth: '24px' }}>{idx + 1}.</strong>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#f0e6d2', fontWeight: '500' }}>{track.title}</span>
                    <span style={{ color: '#949ba4', fontSize: '0.82rem', marginLeft: '10px' }}>
                      ({track.durationFormatted}) · {track.requester}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveTrack(idx)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    marginLeft: '12px',
                    flexShrink: 0,
                  }}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ctrlBtnStyle(disabled, bg = '#334155') {
  return {
    padding: '8px 14px',
    borderRadius: '6px',
    border: 'none',
    background: disabled ? '#1e293b' : bg,
    color: disabled ? '#64748b' : '#fff',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
