import React, { useState, useEffect } from 'react';

function VoiceUsage() {
  // Default to last 14 days
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getPastDateString = (daysAgo) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getPastDateString(14));
  const [endDate, setEndDate] = useState(getTodayString());
  const [isAllTime, setIsAllTime] = useState(false);
  const [usageData, setUsageData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchUsage = () => {
    setLoading(true);
    setError(null);
    const startParam = isAllTime ? 'all' : startDate;
    const endParam = isAllTime ? 'all' : endDate;
    
    fetch(`/api/voice/usage?start=${startParam}&end=${endParam}`)
      .then((res) => {
        if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.');
        return res.json();
      })
      .then((data) => {
        setUsageData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  // Fetch on mount or when dates/toggle change
  useEffect(() => {
    fetchUsage();
  }, [startDate, endDate, isAllTime]);

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const parts = [];
    if (h > 0) parts.push(`${h}시간`);
    if (m > 0) parts.push(`${m}분`);
    if (s > 0 || parts.length === 0) parts.push(`${s}초`);
    
    return parts.join(' ');
  };

  const maxDuration = usageData.length > 0 ? Math.max(...usageData.map((d) => d.totalDuration)) : 1;

  return (
    <div className="voice-usage-page">
      <div className="page-title-section">
        <h2 className="page-title">🎙️ 음성 채널 활동량</h2>
        
        <div className="voice-filters-wrapper">
          <div className="alltime-checkbox-container">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isAllTime}
                onChange={(e) => setIsAllTime(e.target.checked)}
                className="checkbox-input"
              />
              전체 기간 조회
            </label>
          </div>

          <div className="date-filters-grid">
            <div className={`date-input-group ${isAllTime ? 'disabled' : ''}`}>
              <span className="date-input-label">시작일</span>
              <input
                type="date"
                className="password-input date-field"
                value={startDate}
                disabled={isAllTime}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className={`date-input-group ${isAllTime ? 'disabled' : ''}`}>
              <span className="date-input-label">종료일</span>
              <input
                type="date"
                className="password-input date-field"
                value={endDate}
                disabled={isAllTime}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <button 
            className="action-btn secondary refresh-btn" 
            onClick={fetchUsage}
          >
            새로고침
          </button>
        </div>
      </div>

      <div className="voice-content-container">
        {loading ? (
          <div className="hex-card" style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            ⏳ 음성 활동 로그 분석 중...
          </div>
        ) : error ? (
          <div className="hex-card" style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--red-primary)' }}>
            ❌ 에러 발생: {error}
          </div>
        ) : usageData.length > 0 ? (
          isMobile ? (
            /* Mobile Cards Layout */
            <div className="mobile-cards-list">
              {usageData.map((item, index) => {
                const percentage = Math.round((item.totalDuration / maxDuration) * 100);
                const isTopRank = index < 3;
                const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

                return (
                  <div key={item.userId} className={`hex-card mobile-voice-card ${isTopRank ? 'top-rank' : ''}`}>
                    <div className="mobile-card-header">
                      <div className="mobile-rank-name">
                        <span className="mobile-rank-badge">
                          {rankEmoji || `#${index + 1}`}
                        </span>
                        <span className="mobile-player-name">{item.userName}</span>
                      </div>
                      <span className="mobile-voice-sessions" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {item.sessionsCount > 0 ? `접속 ${item.sessionsCount}회` : '-'}
                      </span>
                    </div>

                    <div className="mobile-card-body">
                      <div className="mobile-info-row">
                        <span className="mobile-info-label">총 활동 시간</span>
                        <span className="mobile-info-value" style={{ fontWeight: '700', color: 'var(--gold-primary)' }}>
                          {formatDuration(item.totalDuration)}
                        </span>
                      </div>

                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                          <span>활동 비중 (1등 기준)</span>
                          <span style={{ color: 'var(--gold-light)', fontWeight: '600' }}>{percentage}%</span>
                        </div>
                        <div className="mobile-progress-bar-bg">
                          <div className="mobile-progress-bar-fill" style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Desktop Table Layout */
            <div className="hex-card" style={{ padding: '1.5rem 0' }}>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center' }}>순위</th>
                      <th>이름</th>
                      <th style={{ width: '150px', textAlign: 'center' }}>접속 횟수</th>
                      <th style={{ width: '220px', textAlign: 'right' }}>총 활동 시간</th>
                      <th style={{ paddingLeft: '3rem' }}>지분율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.map((item, index) => {
                      const percentage = Math.round((item.totalDuration / maxDuration) * 100);
                      const isTopRank = index < 3;
                      const rankClass = isTopRank ? `top-${index + 1}` : '';

                      return (
                        <tr key={item.userId}>
                          <td style={{ textAlign: 'center' }} className={`rank-cell ${rankClass}`}>
                            {index + 1}
                          </td>
                          <td style={{ fontWeight: '700', color: 'var(--gold-light)' }}>
                            {item.userName}
                          </td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-heading)', fontWeight: '600' }}>
                            {item.sessionsCount > 0 ? `${item.sessionsCount}회` : '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)' }}>
                            {formatDuration(item.totalDuration)}
                          </td>
                          <td style={{ paddingLeft: '3rem', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ 
                                flex: 1, 
                                height: '8px', 
                                backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                                borderRadius: '4px',
                                overflow: 'hidden',
                                maxWidth: '300px',
                                border: '1px solid rgba(200, 170, 110, 0.15)'
                              }}>
                                <div style={{ 
                                  width: `${percentage}%`, 
                                  height: '100%', 
                                  background: 'linear-gradient(90deg, #c8aa6e, #805c26)',
                                  boxShadow: '0 0 8px rgba(200, 170, 110, 0.5)',
                                  borderRadius: '4px',
                                  transition: 'width 0.5s ease-in-out'
                                }}></div>
                              </div>
                              <span style={{ fontSize: '0.85rem', color: 'var(--gold-primary)', fontWeight: '600', width: '40px' }}>
                                {percentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="hex-card" style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
            📭 선택한 기간 동안의 음성 채널 활동 기록이 존재하지 않습니다.
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceUsage;
