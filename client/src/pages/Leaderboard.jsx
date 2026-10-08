import React, { useState, useEffect } from 'react';

// Helper to calculate tier rank score (lower is higher tier: 1=Challenger, 2=Grandmaster, 3=Master...)
const getTierScore = (tierStr) => {
  if (!tierStr || tierStr === '언랭') return 999;
  const str = tierStr.replace(/\s+/g, '');
  if (str.includes('챌린저')) return 1;
  if (str.includes('그랜드마스터')) return 2;
  if (str.includes('마스터')) return 3;

  let base = 30;
  if (str.includes('다이아')) base = 4;
  else if (str.includes('에메')) base = 8;
  else if (str.includes('플레')) base = 12;
  else if (str.includes('골드')) base = 16;
  else if (str.includes('실버')) base = 20;
  else if (str.includes('브론즈')) base = 24;
  else if (str.includes('아이언')) base = 28;

  let offset = 0;
  if (str.includes('1')) offset = 0;
  else if (str.includes('2')) offset = 1;
  else if (str.includes('3')) offset = 2;
  else if (str.includes('4')) offset = 3;

  return base + offset;
};

// Tier color helper
const getTierColor = (tier) => {
  if (!tier) return '#a09c90';
  const t = tier.toLowerCase();
  if (t.includes('챌린저')) return '#f39c12';
  if (t.includes('그랜드마스터')) return '#e74c3c';
  if (t.includes('마스터')) return '#9b59b6';
  if (t.includes('다이아')) return '#3498db';
  if (t.includes('에메')) return '#2ecc71';
  if (t.includes('플레')) return '#1abc9c';
  if (t.includes('골드')) return '#f1c40f';
  if (t.includes('실버')) return '#8ea2b4';
  if (t.includes('브론즈')) return '#a97142';
  if (t.includes('아이언')) return '#726c68';
  return '#a09c90';
};

function Leaderboard({ players }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sort strictly by Highest Tier first, then wins
  const sortedPlayers = [...players].sort((a, b) => {
    const tierA = getTierScore(a.highestTier || a.currentTier);
    const tierB = getTierScore(b.highestTier || b.currentTier);
    if (tierA !== tierB) return tierA - tierB;
    return (b.wins || 0) - (a.wins || 0);
  });

  // Filter players by name or nickname
  const filteredPlayers = sortedPlayers.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.nickname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.highestTier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.currentTier || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to calculate win rate
  const getWinRate = (wins, losses) => {
    const total = (wins || 0) + (losses || 0);
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  // Helper to format total voice time
  const formatTotalVoiceTime = (seconds) => {
    if (!seconds) return '0분';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) {
      return `${h}시간 ${m}분`;
    }
    return `${m}분`;
  };

  return (
    <div className="leaderboard-page">
      <div className="page-title-section">
        <div>
          <h2 className="page-title">내전 소환사 랭킹판</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            모든 소환사는 <strong>최고 티어</strong>를 기준으로 실시간 자동 정렬됩니다.
          </p>
        </div>
        <div className="search-filters-wrapper">
          <input 
            type="text" 
            placeholder="🔎 소환사 이름, 닉네임, 티어 검색..." 
            className="password-input search-field" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isMobile ? (
        /* Mobile Layout: Responsive Card List */
        <div className="mobile-cards-list">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((p, index) => {
              const winRate = getWinRate(p.wins, p.losses);
              const isTopRank = index < 3;
              const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
              const highestTierColor = getTierColor(p.highestTier || p.currentTier);

              return (
                <div key={p.id} className={`hex-card mobile-player-card ${isTopRank ? 'top-rank' : ''}`}>
                  <div className="mobile-card-header">
                    <div className="mobile-rank-name">
                      <span className="mobile-rank-badge">
                        {rankEmoji || `#${index + 1}`}
                      </span>
                      <span className="mobile-player-name">{p.name}</span>
                    </div>
                    <span
                      style={{
                        color: highestTierColor,
                        fontWeight: '800',
                        fontSize: '0.95rem',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: `1px solid ${highestTierColor}50`
                      }}
                    >
                      👑 {p.highestTier || p.currentTier || '언랭'}
                    </span>
                  </div>
                  
                  <div className="mobile-card-body">
                    <div className="mobile-info-row">
                      <span className="mobile-info-label">닉네임</span>
                      <span className="mobile-info-value">
                        {p.nickname?.split('#')[0] || p.nickname}
                        <span className="player-ign-sub">#{p.nickname?.split('#')[1] || 'KR1'}</span>
                      </span>
                    </div>

                    <div className="mobile-info-row">
                      <span className="mobile-info-label">현재 티어</span>
                      <span className="mobile-info-value" style={{ color: 'var(--text-muted)', fontWeight: '600' }}>
                        {p.currentTier || '언랭'}
                      </span>
                    </div>

                    <div className="mobile-info-row">
                      <span className="mobile-info-label">나이</span>
                      <span className="mobile-info-value">{p.age}세</span>
                    </div>

                    <div className="mobile-info-row" style={{ alignItems: 'center' }}>
                      <span className="mobile-info-label">선호 포지션</span>
                      <span className="mobile-info-value">
                        <div className="lane-badges" style={{ gap: '3px' }}>
                          <span className={`lane-dot ${p.lineTop ? 'active' : ''}`}>탑</span>
                          <span className={`lane-dot ${p.lineJungle ? 'active' : ''}`}>정글</span>
                          <span className={`lane-dot ${p.lineMid ? 'active' : ''}`}>미드</span>
                          <span className={`lane-dot ${p.lineAd ? 'active' : ''}`}>원딜</span>
                          <span className={`lane-dot ${p.lineSupport ? 'active' : ''}`}>서폿</span>
                        </div>
                      </span>
                    </div>

                    <div className="mobile-info-row">
                      <span className="mobile-info-label">전적 (승/패)</span>
                      <span className="mobile-info-value" style={{ fontWeight: '600' }}>
                        <span style={{ color: 'var(--blue-primary)' }}>{p.wins || 0}승</span> / <span style={{ color: 'var(--red-primary)' }}>{p.losses || 0}패</span>
                        <span style={{ marginLeft: '8px', color: winRate >= 55 ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
                          ({winRate}%)
                        </span>
                      </span>
                    </div>

                    <div className="mobile-info-row">
                      <span className="mobile-info-label">활동 시간</span>
                      <span className="mobile-info-value" style={{ color: 'var(--text-muted)' }}>
                        {formatTotalVoiceTime(p.totalVoiceTime)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="hex-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
              등록된 소환사가 없거나 검색 결과가 없습니다.
            </div>
          )}
        </div>
      ) : (
        /* Desktop Layout: Standard Table */
        <div className="hex-card" style={{ padding: '1.5rem 0' }}>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '80px', textAlign: 'center' }}>순위</th>
                  <th>이름</th>
                  <th>닉네임</th>
                  <th style={{ color: 'var(--gold-primary)' }}>👑 최고 티어 (정렬 기준)</th>
                  <th>현재 티어</th>
                  <th style={{ textAlign: 'center' }}>선호 포지션</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>전적 (승/패)</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>승률</th>
                  <th style={{ textAlign: 'right', width: '130px', paddingRight: '2rem' }}>활동 시간</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.length > 0 ? (
                  filteredPlayers.map((p, index) => {
                    const winRate = getWinRate(p.wins, p.losses);
                    const isTopRank = index < 3;
                    const rankClass = isTopRank ? `top-${index + 1}` : '';
                    const highestTierColor = getTierColor(p.highestTier || p.currentTier);
                    
                    return (
                      <tr key={p.id}>
                        <td style={{ textAlign: 'center' }} className={`rank-cell ${rankClass}`}>
                          {index + 1}
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--gold-light)' }}>{p.name}</td>
                        <td>
                          {p.nickname?.split('#')[0] || p.nickname}
                          <span className="player-ign-sub">#{p.nickname?.split('#')[1] || 'KR1'}</span>
                        </td>
                        <td>
                          <span
                            style={{
                              color: highestTierColor,
                              fontWeight: '800',
                              fontSize: '0.95rem',
                              background: 'rgba(0,0,0,0.25)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: `1px solid ${highestTierColor}40`
                            }}
                          >
                            👑 {p.highestTier || p.currentTier || '언랭'}
                          </span>
                        </td>
                        <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{p.currentTier || '언랭'}</td>
                        <td>
                          <div className="lane-badges" style={{ justifyContent: 'center' }}>
                            <span className={`lane-dot ${p.lineTop ? 'active' : ''}`}>탑</span>
                            <span className={`lane-dot ${p.lineJungle ? 'active' : ''}`}>정글</span>
                            <span className={`lane-dot ${p.lineMid ? 'active' : ''}`}>미드</span>
                            <span className={`lane-dot ${p.lineAd ? 'active' : ''}`}>원딜</span>
                            <span className={`lane-dot ${p.lineSupport ? 'active' : ''}`}>서폿</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-heading)', fontWeight: '600' }}>
                          <span style={{ color: 'var(--blue-primary)' }}>{p.wins || 0}승</span>
                          {' '}/{' '}
                          <span style={{ color: 'var(--red-primary)' }}>{p.losses || 0}패</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`winrate-text ${winRate >= 55 ? 'high' : ''}`}>
                            {winRate}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)', paddingRight: '2rem' }}>
                          {formatTotalVoiceTime(p.totalVoiceTime)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                      등록된 소환사가 없거나 검색 결과가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
