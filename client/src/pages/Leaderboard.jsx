import React, { useState, useEffect } from 'react';

function Leaderboard({ players }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter players by name or nickname
  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nickname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to calculate win rate
  const getWinRate = (wins, losses) => {
    const total = wins + losses;
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
        <h2 className="page-title">내전 MMR 랭킹판</h2>
        <div className="search-filters-wrapper">
          <input 
            type="text" 
            placeholder="🔎 소환사 이름 검색..." 
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

              return (
                <div key={p.id} className={`hex-card mobile-player-card ${isTopRank ? 'top-rank' : ''}`}>
                  <div className="mobile-card-header">
                    <div className="mobile-rank-name">
                      <span className="mobile-rank-badge">
                        {rankEmoji || `#${index + 1}`}
                      </span>
                      <span className="mobile-player-name">{p.name}</span>
                    </div>
                    <span className="mobile-player-mmr">{p.mmr} MMR</span>
                  </div>
                  
                  <div className="mobile-card-body">
                    <div className="mobile-info-row">
                      <span className="mobile-info-label">닉네임</span>
                      <span className="mobile-info-value">
                        {p.nickname.split('#')[0]}
                        <span className="player-ign-sub">#{p.nickname.split('#')[1] || 'KR1'}</span>
                      </span>
                    </div>

                    <div className="mobile-info-row">
                      <span className="mobile-info-label">소환사 티어</span>
                      <span className="mobile-info-value" style={{ color: 'var(--gold-light)', fontWeight: '600' }}>
                        {p.currentTier}
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
                        <span style={{ color: 'var(--blue-primary)' }}>{p.wins}승</span> / <span style={{ color: 'var(--red-primary)' }}>{p.losses}패</span>
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
                  <th>현재 티어</th>
                  <th style={{ textAlign: 'center' }}>선호 포지션</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>전적 (승/패)</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>승률</th>
                  <th style={{ textAlign: 'right', width: '130px' }}>활동 시간</th>
                  <th style={{ textAlign: 'right', width: '120px', paddingRight: '2rem' }}>MMR</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.length > 0 ? (
                  filteredPlayers.map((p, index) => {
                    const winRate = getWinRate(p.wins, p.losses);
                    const isTopRank = index < 3;
                    const rankClass = isTopRank ? `top-${index + 1}` : '';
                    
                    return (
                      <tr key={p.id}>
                        <td style={{ textAlign: 'center' }} className={`rank-cell ${rankClass}`}>
                          {index + 1}
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--gold-light)' }}>{p.name}</td>
                        <td>
                          {p.nickname.split('#')[0]}
                          <span className="player-ign-sub">#{p.nickname.split('#')[1] || 'KR1'}</span>
                        </td>
                        <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{p.currentTier}</td>
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
                          <span style={{ color: 'var(--blue-primary)' }}>{p.wins}승</span>
                          {' '}/{' '}
                          <span style={{ color: 'var(--red-primary)' }}>{p.losses}패</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`winrate-text ${winRate >= 55 ? 'high' : ''}`}>
                            {winRate}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)' }}>
                          {formatTotalVoiceTime(p.totalVoiceTime)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--gold-primary)', paddingRight: '2rem', fontSize: '1.05rem' }}>
                          {p.mmr}
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
