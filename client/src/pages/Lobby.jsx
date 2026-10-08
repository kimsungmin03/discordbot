import React from 'react';

function Lobby({ lobby }) {
  // Generate 10 slots
  const slots = Array.from({ length: 10 }, (_, i) => {
    const player = lobby?.participants?.[i] || null;
    return { number: i + 1, player };
  });

  return (
    <div className="lobby-page">
      <div className="page-title-section">
        <h2 className="page-title">실시간 대기열 현황</h2>
        {lobby ? (
          <span className={`lobby-status-badge ${lobby.status === 'COMPLETED' ? 'closed' : ''}`}>
            {lobby.status === 'OPEN' ? `모집 중 (${lobby.participants.length}/10)` : '모집 완료'}
          </span>
        ) : (
          <span className="lobby-status-badge closed">비활성 대기열</span>
        )}
      </div>

      <div className="lobby-dashboard">
        {/* Left Column: Player Slots Grid */}
        <div className="hex-card">
          <div className="lobby-header">
            <h3>참가 신청 리스트</h3>
            {lobby && <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>모집자: {lobby.creatorName}</p>}
          </div>

          <div className="slots-grid">
            {slots.map((slot) => {
              const p = slot.player;
              return (
                <div key={slot.number} className={`slot-card ${p ? 'occupied' : ''}`}>
                  <div className="slot-number">
                    {String(slot.number).padStart(2, '0')}
                  </div>
                  <div className="player-info-wrapper">
                    {p ? (
                      <>
                        <div className="player-name-row">
                          <span className="player-name">{p.name}</span>
                          <span className="player-tier">{p.currentTier}</span>
                        </div>
                        <div className="player-meta-row">
                          <span className="player-nickname" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {p.nickname}
                          </span>
                          <div className="lane-badges">
                            <span className={`lane-dot ${p.lineTop ? 'active' : ''}`}>T</span>
                            <span className={`lane-dot ${p.lineJungle ? 'active' : ''}`}>J</span>
                            <span className={`lane-dot ${p.lineMid ? 'active' : ''}`}>M</span>
                            <span className={`lane-dot ${p.lineAd ? 'active' : ''}`}>A</span>
                            <span className={`lane-dot ${p.lineSupport ? 'active' : ''}`}>S</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="empty-slot-text">👤 빈 자리</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Matched Teams (if generated) */}
        <div className="lobby-sidebar">
          {lobby?.blueTeam && lobby?.redTeam ? (
            <div className="teams-sidebar-section">
              <div className="hex-card" style={{ marginBottom: '1.5rem', borderColor: 'var(--blue-primary)' }}>
                <h3 style={{ color: 'var(--blue-primary)', marginBottom: '1rem' }}>🔵 1팀 (블루)</h3>
                <div className="team-players-list">
                  {JSON.parse(lobby.blueTeam).map((name, i) => (
                    <div key={i} className="team-player-row" style={{ padding: '0.65rem 0' }}>
                      <span style={{ fontWeight: '700', color: 'var(--gold-light)' }}>{i + 1}. {name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hex-card" style={{ borderColor: 'var(--red-primary)' }}>
                <h3 style={{ color: 'var(--red-primary)', marginBottom: '1rem' }}>🔴 2팀 (레드)</h3>
                <div className="team-players-list">
                  {JSON.parse(lobby.redTeam).map((name, i) => (
                    <div key={i} className="team-player-row" style={{ padding: '0.65rem 0' }}>
                      <span style={{ fontWeight: '700', color: 'var(--gold-light)' }}>{i + 1}. {name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="hex-card" style={{ textAlign: 'center', padding: '3rem 2rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
              <h4 style={{ color: 'var(--gold-primary)', marginBottom: '0.5rem' }}>구글 시트 실시간 연동</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                디스코드 대기열에 등록된 참가자 명단은 구글 시트의 <strong>C2:C11</strong> 영역에 실시간으로 자동 동기화됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Lobby;
