import React, { useState } from 'react';

function Matchup({ matches }) {
  const [adminPassword, setAdminPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submittingMatchId, setSubmittingMatchId] = useState(null);

  const pendingMatches = matches.filter(m => m.winner === 'PENDING');
  const resolvedMatches = matches.filter(m => m.winner !== 'PENDING');

  const handleResolveMatch = async (matchId, winnerSide) => {
    setErrorMessage('');
    setSuccessMessage('');
    setSubmittingMatchId(matchId);

    const password = adminPassword.trim() || 'admin123';

    try {
      const response = await fetch('/api/match/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({
          matchId,
          winner: winnerSide // "BLUE" or "RED"
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '결과 등록에 실패했습니다.');
      }

      setSuccessMessage(`🎉 매치 #${matchId} 결과가 성공적으로 등록되었습니다! (${winnerSide} 승리)`);
      setAdminPassword('');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSubmittingMatchId(null);
    }
  };

  return (
    <div className="matchup-page">
      <div className="page-title-section">
        <h2 className="page-title">내전 매치 결과 및 보고</h2>
      </div>

      {/* SUCCESS / ERROR ALERTS */}
      {successMessage && (
        <div className="hex-card" style={{ borderColor: 'var(--blue-primary)', backgroundColor: 'rgba(0,162,232,0.1)', marginBottom: '2rem', padding: '1.25rem' }}>
          <span style={{ color: 'var(--blue-primary)', fontWeight: '700' }}>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="hex-card" style={{ borderColor: 'var(--red-primary)', backgroundColor: 'rgba(255,70,85,0.1)', marginBottom: '2rem', padding: '1.25rem' }}>
          <span style={{ color: 'var(--red-primary)', fontWeight: '700' }}>⚠️ 오류: {errorMessage}</span>
        </div>
      )}

      {/* SECTION 1: PENDING MATCHES (ACTIVE GAMES) */}
      <div style={{ marginBottom: '4rem' }}>
        <h3 style={{ color: 'var(--gold-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⚔️ 진행 중인 매치 (결과 대기)</span>
          {pendingMatches.length > 0 && (
            <span className="lobby-status-badge" style={{ animation: 'pulse 2s infinite' }}>{pendingMatches.length}개 대기</span>
          )}
        </h3>

        {pendingMatches.length > 0 ? (
          pendingMatches.map((match) => {
            const blue = JSON.parse(match.blueTeam);
            const red = JSON.parse(match.redTeam);

            return (
              <div key={match.id} className="hex-card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '800', fontSize: '1.15rem' }}>매치 ID: #{match.id}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{new Date(match.date).toLocaleString()}</span>
                </div>

                <div className="matchup-container">
                  {/* Blue Team Side */}
                  <div className="team-card blue-side">
                    <div className="team-header blue-side">
                      <span>🔵 블루 팀</span>
                    </div>
                    <div className="team-players-list">
                      {blue.map((name, i) => (
                        <div key={i} className="team-player-row">
                          <span style={{ fontWeight: '700' }}>{i + 1}. {name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Red Team Side */}
                  <div className="team-card red-side">
                    <div className="team-header red-side">
                      <span>🔴 레드 팀</span>
                    </div>
                    <div className="team-players-list">
                      {red.map((name, i) => (
                        <div key={i} className="team-player-row">
                          <span style={{ fontWeight: '700' }}>{i + 1}. {name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Victory Reporting Interface */}
                <div className="report-victory-section">
                  <div className="password-input-group">
                    <label className="input-label">관리자 비밀번호</label>
                    <input 
                      type="password" 
                      placeholder="비밀번호 입력 (기본: admin123)" 
                      className="password-input"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                  </div>

                  <div className="report-buttons">
                    <button 
                      className="btn-victory blue-btn"
                      disabled={submittingMatchId !== null}
                      onClick={() => handleResolveMatch(match.id, 'BLUE')}
                    >
                      블루 팀 승리 보고
                    </button>
                    <button 
                      className="btn-victory red-btn"
                      disabled={submittingMatchId !== null}
                      onClick={() => handleResolveMatch(match.id, 'RED')}
                    >
                      레드 팀 승리 보고
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="hex-card" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
            현재 진행 중인 내전 매치가 없습니다.
          </div>
        )}
      </div>

      {/* SECTION 2: MATCH HISTORY (RECENT RESOLVED) */}
      <div>
        <h3 style={{ color: 'var(--gold-primary)', marginBottom: '1.5rem' }}>📜 최근 내전 전적 (최근 20경기)</h3>
        
        <div className="matches-list">
          {resolvedMatches.length > 0 ? (
            resolvedMatches.map((match) => {
              const blue = JSON.parse(match.blueTeam);
              const red = JSON.parse(match.redTeam);
              const isBlueWinner = match.winner === 'BLUE';

              return (
                <div key={match.id} className="hex-card match-item">
                  <div className="match-status resolved">
                    ID #{match.id}
                  </div>
                  
                  {/* Blue Team list summary */}
                  <div className="match-team-names" style={{ textAlign: 'right', color: isBlueWinner ? '#fff' : 'var(--text-muted)' }}>
                    {blue.join(', ')}
                  </div>
                  
                  {/* VS / Winner badge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>VS</span>
                    <span className={`match-winner-badge ${isBlueWinner ? 'blue-win' : 'red-win'}`}>
                      {isBlueWinner ? '🔵 블루 승' : '🔴 레드 승'}
                    </span>
                  </div>

                  {/* Red Team list summary */}
                  <div className="match-team-names" style={{ textAlign: 'left', color: !isBlueWinner ? '#fff' : 'var(--text-muted)' }}>
                    {red.join(', ')}
                  </div>

                  {/* Match Date */}
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {new Date(match.date).toLocaleDateString()}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="hex-card" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
              기록된 전적이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Matchup;
