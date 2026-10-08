import React, { useState, useEffect } from 'react';

// Tier rank calculation helper (Lower score = higher tier)
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

// Map score back to friendly tier name for averages
const getScoreTierName = (score) => {
  if (score <= 1.5) return '챌린저';
  if (score <= 2.5) return '그랜드마스터';
  if (score <= 3.5) return '마스터';
  if (score <= 4.5) return '다이아1';
  if (score <= 5.5) return '다이아2';
  if (score <= 6.5) return '다이아3';
  if (score <= 7.5) return '다이아4';
  if (score <= 8.5) return '에메1';
  if (score <= 9.5) return '에메2';
  if (score <= 10.5) return '에메3';
  if (score <= 11.5) return '에메4';
  if (score <= 12.5) return '플레1';
  if (score <= 13.5) return '플레2';
  if (score <= 14.5) return '플레3';
  if (score <= 15.5) return '플레4';
  if (score <= 16.5) return '골드1';
  if (score <= 17.5) return '골드2';
  if (score <= 18.5) return '골드3';
  if (score <= 19.5) return '골드4';
  if (score <= 20.5) return '실버1';
  if (score <= 21.5) return '실버2';
  if (score <= 22.5) return '실버3';
  if (score <= 23.5) return '실버4';
  if (score <= 27.5) return '브론즈';
  if (score <= 31.5) return '아이언';
  return '언랭';
};

// Default mock players sorted strictly by highestTier
const DEFAULT_PLAYERS = [
  { id: 'p1', name: '김민수', nickname: 'Hide on bush#KR1', currentTier: '챌린저', highestTier: '챌린저', mainPosition: '미드', lineMid: true, lineTop: true },
  { id: 'p8', name: '송민호', nickname: 'Zeka#KR1', currentTier: '챌린저', highestTier: '챌린저', mainPosition: '미드', lineMid: true },
  { id: 'p5', name: '정유진', nickname: 'Keria#KR1', currentTier: '그랜드마스터', highestTier: '챌린저', mainPosition: '서폿', lineSupport: true, lineMid: true },
  { id: 'p7', name: '윤서진', nickname: 'Peanut#KR1', currentTier: '그랜드마스터', highestTier: '챌린저', mainPosition: '정글', lineJungle: true },
  { id: 'p9', name: '한상우', nickname: 'Viper#KR1', currentTier: '마스터', highestTier: '챌린저', mainPosition: '원딜', lineAd: true },
  { id: 'p2', name: '이도현', nickname: 'Zeus#KR1', currentTier: '그랜드마스터', highestTier: '그랜드마스터', mainPosition: '탑', lineTop: true },
  { id: 'p4', name: '최준혁', nickname: 'Gumayusi#KR1', currentTier: '마스터', highestTier: '그랜드마스터', mainPosition: '원딜', lineAd: true },
  { id: 'p6', name: '강동원', nickname: 'Doran#KR1', currentTier: '마스터', highestTier: '그랜드마스터', mainPosition: '탑', lineTop: true },
  { id: 'p3', name: '박지원', nickname: 'Oner#KR1', currentTier: '마스터', highestTier: '마스터', mainPosition: '정글', lineJungle: true },
  { id: 'p10', name: '임태훈', nickname: 'Delight#KR1', currentTier: '다이아1', highestTier: '마스터', mainPosition: '서폿', lineSupport: true },
];

// Slot roles: 팀장, 1픽, 2픽, 3픽, 4픽
const SLOT_ROLES = ['팀장', '1픽', '2픽', '3픽', '4픽'];
const SLOT_ICONS = {
  '팀장': '👑',
  '1픽': '🥇',
  '2픽': '🥈',
  '3픽': '🥉',
  '4픽': '🎖️'
};

// Standard LoL Snake Draft Sequence for 8 remaining picks after 2 Captains:
// 1팀 -> 2팀 -> 2팀 -> 1팀 -> 1팀 -> 2팀 -> 2팀 -> 1팀
const DRAFT_SEQUENCE = [
  { step: 1, team: 1, slotRole: '1픽', slotIndex: 1, label: '1팀 1픽' },
  { step: 2, team: 2, slotRole: '1픽', slotIndex: 1, label: '2팀 1픽' },
  { step: 3, team: 2, slotRole: '2픽', slotIndex: 2, label: '2팀 2픽' },
  { step: 4, team: 1, slotRole: '2픽', slotIndex: 2, label: '1팀 2픽' },
  { step: 5, team: 1, slotRole: '3픽', slotIndex: 3, label: '1팀 3픽' },
  { step: 6, team: 2, slotRole: '3픽', slotIndex: 3, label: '2팀 3픽' },
  { step: 7, team: 2, slotRole: '4픽', slotIndex: 4, label: '2팀 4픽' },
  { step: 8, team: 1, slotRole: '4픽', slotIndex: 4, label: '1팀 4픽' },
];

// Tier color palette
const getTierColor = (tier) => {
  if (!tier) return '#a09c90';
  const t = tier.toLowerCase();
  if (t.includes('챌린저')) return '#f39c12';
  if (t.includes('그랜드마스터')) return '#e74c3c';
  if (t.includes('마스터')) return '#9b59b6';
  if (t.includes('다이아')) return '#3498db';
  if (t.includes('에메랄드') || t.includes('에메')) return '#2ecc71';
  if (t.includes('플레티넘') || t.includes('플레')) return '#1abc9c';
  if (t.includes('골드')) return '#f1c40f';
  if (t.includes('실버')) return '#8ea2b4';
  if (t.includes('브론즈')) return '#a97142';
  if (t.includes('아이언')) return '#726c68';
  return '#a09c90';
};

// Generates consistent LoL avatar URL based on string
const getAvatarUrl = (name, index) => {
  const iconIds = [588, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29, 32, 532, 548, 563, 612];
  let charSum = 0;
  for (let i = 0; i < (name || '').length; i++) {
    charSum += (name || '').charCodeAt(i);
  }
  const iconId = iconIds[(charSum + index) % iconIds.length];
  return `https://ddragon.leagueoflegends.com/cdn/14.20.1/img/profileicon/${iconId}.png`;
};

function TeamDraft({ lobby, allPlayers, onNavigateTab }) {
  // Pool of players currently waiting to be picked (Unassigned)
  const [pool, setPool] = useState([]);
  
  // 1팀 선수 목록 (5 slots: [팀장, 1픽, 2픽, 3픽, 4픽])
  const [team1Slots, setTeam1Slots] = useState([null, null, null, null, null]);
  // 2팀 선수 목록 (5 slots: [팀장, 1픽, 2픽, 3픽, 4픽])
  const [team2Slots, setTeam2Slots] = useState([null, null, null, null, null]);

  // History stack for Undo
  const [pickHistory, setPickHistory] = useState([]);

  // Final Side Selection (Decided at the very end):
  // team1Side: 'BLUE' | 'RED', team2Side: 'RED' | 'BLUE'
  const [team1Side, setTeam1Side] = useState('BLUE');

  // Modal for picking 10 players from all DB players
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [selectedRosterIds, setSelectedRosterIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Status message
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sort helper by highestTier
  const sortByHighestTier = (list) => {
    return [...list].sort((a, b) => {
      const scoreA = getTierScore(a.highestTier || a.currentTier);
      const scoreB = getTierScore(b.highestTier || b.currentTier);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return (b.wins || 0) - (a.wins || 0);
    });
  };

  // Determine current draft phase / target slot:
  // Phase 1: Team 1 Captain (team1Slots[0] is null)
  // Phase 2: Team 2 Captain (team2Slots[0] is null)
  // Phase 3: Snake pick sequence (Step 1 ~ 8)
  const getCurrentDraftTarget = () => {
    if (!team1Slots[0]) {
      return { type: 'CAPTAIN', team: 1, slotIndex: 0, label: '👑 1팀 팀장' };
    }
    if (!team2Slots[0]) {
      return { type: 'CAPTAIN', team: 2, slotIndex: 0, label: '👑 2팀 팀장' };
    }

    // Captains are set, find next slot in DRAFT_SEQUENCE
    for (const seq of DRAFT_SEQUENCE) {
      const targetSlots = seq.team === 1 ? team1Slots : team2Slots;
      if (!targetSlots[seq.slotIndex]) {
        return {
          type: 'PICK',
          team: seq.team,
          slotIndex: seq.slotIndex,
          slotRole: seq.slotRole,
          label: seq.label,
          step: seq.step,
        };
      }
    }

    return null; // All 10 players picked!
  };

  const currentTarget = getCurrentDraftTarget();

  // Initialize pool from lobby participants or DB players (sorted by highest tier)
  useEffect(() => {
    initDraftPool();
  }, [lobby, allPlayers]);

  const initDraftPool = () => {
    let source = [];
    if (lobby && lobby.participants && lobby.participants.length > 0) {
      source = lobby.participants.slice(0, 10);
    } else if (allPlayers && allPlayers.length >= 10) {
      source = allPlayers.slice(0, 10);
    } else {
      source = DEFAULT_PLAYERS;
    }

    setPool(sortByHighestTier(source));
    setTeam1Slots([null, null, null, null, null]);
    setTeam2Slots([null, null, null, null, null]);
    setPickHistory([]);
    setTeam1Side('BLUE');
  };

  // Click on a player icon in the waiting pool: PICK PLAYER
  const handlePlayerClick = (player) => {
    if (!currentTarget) {
      showFeedback('🎉 10명 배정이 이미 완료되었습니다! 아래에서 진영(블루/레드)을 선택하세요.', 'info');
      return;
    }

    assignPlayerToSlot(player, currentTarget.team, currentTarget.slotIndex);
  };

  // Assign player to specific team slot
  const assignPlayerToSlot = (player, team, slotIdx) => {
    // Record history for undo
    setPickHistory(prev => [...prev, {
      player,
      team,
      slotIdx,
      prevPool: pool,
      prevTeam1: [...team1Slots],
      prevTeam2: [...team2Slots],
    }]);

    // Remove from pool
    setPool(prev => prev.filter(p => p.id !== player.id));

    if (team === 1) {
      setTeam1Slots(prev => {
        const next = [...prev];
        next[slotIdx] = player;
        return next;
      });
    } else {
      setTeam2Slots(prev => {
        const next = [...prev];
        next[slotIdx] = player;
        return next;
      });
    }
  };

  // Undo last pick
  const handleUndoLastPick = () => {
    if (pickHistory.length === 0) {
      showFeedback('되돌릴 픽 기록이 없습니다.', 'warning');
      return;
    }

    const last = pickHistory[pickHistory.length - 1];
    setPool(last.prevPool);
    setTeam1Slots(last.prevTeam1);
    setTeam2Slots(last.prevTeam2);
    setPickHistory(prev => prev.slice(0, -1));
    showFeedback('↩️ 직전 픽을 취소하고 되돌렸습니다.', 'info');
  };

  // Remove player from a specific slot back to waiting pool
  const handleRemoveFromSlot = (team, slotIdx, e) => {
    if (e) e.stopPropagation();
    const player = team === 1 ? team1Slots[slotIdx] : team2Slots[slotIdx];
    if (!player) return;

    if (team === 1) {
      setTeam1Slots(prev => {
        const next = [...prev];
        next[slotIdx] = null;
        return next;
      });
    } else {
      setTeam2Slots(prev => {
        const next = [...prev];
        next[slotIdx] = null;
        return next;
      });
    }

    setPool(prev => sortByHighestTier([...prev, player]));
  };

  // Reset all assignments back to waiting pool
  const handleResetAll = () => {
    const all = [
      ...pool,
      ...team1Slots.filter(Boolean),
      ...team2Slots.filter(Boolean),
    ];
    setPool(sortByHighestTier(all));
    setTeam1Slots([null, null, null, null, null]);
    setTeam2Slots([null, null, null, null, null]);
    setPickHistory([]);
    setTeam1Side('BLUE');
    showFeedback('🔄 모든 선수가 대기실로 복귀했습니다.', 'info');
  };

  // AI Optimal Highest-Tier Balance Algorithm:
  // Captain 1: highest tier #1, Captain 2: highest tier #2
  // Then Snake-draft balance the rest according to 1-2-2-1-1-2-2-1 sequence!
  const handleBalanceTeam = () => {
    const all = [
      ...pool,
      ...team1Slots.filter(Boolean),
      ...team2Slots.filter(Boolean),
    ];

    if (all.length < 10) {
      showFeedback('⚠️ 총 10명의 선수가 필요합니다.', 'warning');
      return;
    }

    const tenPlayers = sortByHighestTier(all.slice(0, 10));

    // Cap 1 = Rank 1, Cap 2 = Rank 2
    const cap1 = tenPlayers[0];
    const cap2 = tenPlayers[1];
    const remaining = tenPlayers.slice(2); // 8 players

    // We distribute 8 players to (4 for Team 1, 4 for Team 2) minimizing difference
    const tierScores = remaining.map(p => getTierScore(p.highestTier || p.currentTier));
    const targetDiff = getTierScore(cap2.highestTier || cap2.currentTier) - getTierScore(cap1.highestTier || cap1.currentTier);

    // 8 choose 4
    const combinations = (arr, k) => {
      const res = [];
      const comb = (start, chosen) => {
        if (chosen.length === k) {
          res.push([...chosen]);
          return;
        }
        for (let i = start; i < arr.length; i++) {
          chosen.push(i);
          comb(i + 1, chosen);
          chosen.pop();
        }
      };
      comb(0, []);
      return res;
    };

    const allCombos = combinations(remaining, 4);
    let bestCombo = allCombos[0];
    let minDiff = Infinity;

    for (const combo of allCombos) {
      const sum1 = combo.reduce((acc, idx) => acc + tierScores[idx], 0) + getTierScore(cap1.highestTier || cap1.currentTier);
      const otherIndices = [0, 1, 2, 3, 4, 5, 6, 7].filter(i => !combo.includes(i));
      const sum2 = otherIndices.reduce((acc, idx) => acc + tierScores[idx], 0) + getTierScore(cap2.highestTier || cap2.currentTier);
      const diff = Math.abs(sum1 - sum2);
      if (diff < minDiff) {
        minDiff = diff;
        bestCombo = combo;
      }
    }

    const t1Picks = bestCombo.map(i => remaining[i]);
    const t2Picks = [0, 1, 2, 3, 4, 5, 6, 7].filter(i => !bestCombo.includes(i)).map(i => remaining[i]);

    // Sort team picks by highest tier
    const sortedT1Picks = sortByHighestTier(t1Picks);
    const sortedT2Picks = sortByHighestTier(t2Picks);

    setTeam1Slots([cap1, sortedT1Picks[0], sortedT1Picks[1], sortedT1Picks[2], sortedT1Picks[3]]);
    setTeam2Slots([cap2, sortedT2Picks[0], sortedT2Picks[1], sortedT2Picks[2], sortedT2Picks[3]]);
    setPool(all.slice(10));
    setPickHistory([]);
    showFeedback('👑 팀장 2명 및 1~4픽 최고 티어 최적 밸런스 배정 완료!', 'success');
  };

  // Random 5:5 shuffle
  const handleRandomShuffle = () => {
    const all = [
      ...pool,
      ...team1Slots.filter(Boolean),
      ...team2Slots.filter(Boolean),
    ];
    if (all.length < 10) {
      showFeedback('⚠️ 총 10명의 선수가 필요합니다.', 'warning');
      return;
    }
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    setTeam1Slots(shuffled.slice(0, 5));
    setTeam2Slots(shuffled.slice(5, 10));
    setPool(shuffled.slice(10));
    setPickHistory([]);
    showFeedback('🔀 무작위 5:5 셔플이 완료되었습니다!', 'success');
  };

  // Side Selection Helpers
  const toggleTeamSides = () => {
    setTeam1Side(prev => prev === 'BLUE' ? 'RED' : 'BLUE');
  };

  const handleCoinTossSide = () => {
    const randomSide = Math.random() < 0.5 ? 'BLUE' : 'RED';
    setTeam1Side(randomSide);
    showFeedback(`🎲 코인 토스 결과: 1팀이 [${randomSide === 'BLUE' ? '🔵 블루' : '🔴 레드'}] 진영으로 결정되었습니다!`, 'success');
  };

  const team2Side = team1Side === 'BLUE' ? 'RED' : 'BLUE';

  // Check if all 10 slots are filled
  const isAllFilled = team1Slots.every(Boolean) && team2Slots.every(Boolean);

  // Submit and confirm match
  const handleConfirmMatch = async () => {
    if (!isAllFilled) {
      showFeedback('⚠️ 1팀과 2팀의 모든 슬롯(팀장 + 1~4픽)이 채워져야 매치를 확정할 수 있습니다.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const team1Names = team1Slots.map(p => p.name);
      const team2Names = team2Slots.map(p => p.name);

      // Map according to chosen side!
      const blueTeamNames = team1Side === 'BLUE' ? team1Names : team2Names;
      const redTeamNames = team1Side === 'BLUE' ? team2Names : team1Names;

      const res = await fetch('/api/match/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueTeam: blueTeamNames,
          redTeam: redTeamNames,
          lobbyId: lobby?.id || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '매치 생성에 실패했습니다.');

      showFeedback(`🎉 매치 #${data.match.id} 생성 완료! (1팀: ${team1Side === 'BLUE' ? '블루' : '레드'}, 2팀: ${team2Side === 'BLUE' ? '블루' : '레드'})`, 'success');
      
      if (onNavigateTab) {
        setTimeout(() => {
          onNavigateTab('matchup');
        }, 1500);
      }
    } catch (err) {
      showFeedback(`❌ 오류: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sync draft teams to active lobby without starting match
  const handleSyncToLobby = async () => {
    try {
      const team1Names = team1Slots.filter(Boolean).map(p => p.name);
      const team2Names = team2Slots.filter(Boolean).map(p => p.name);

      const blueTeamNames = team1Side === 'BLUE' ? team1Names : team2Names;
      const redTeamNames = team1Side === 'BLUE' ? team2Names : team1Names;

      const res = await fetch('/api/lobby/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueTeam: blueTeamNames,
          redTeam: redTeamNames,
          lobbyId: lobby?.id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '로비 동기화 실패');

      showFeedback('✅ 대기열 현황과 구글 시트에 현재 팀 배정이 저장되었습니다!', 'success');
    } catch (err) {
      showFeedback(`⚠️ 동기화 실패: ${err.message}`, 'warning');
    }
  };

  const showFeedback = (msg, type = 'info') => {
    setStatusMessage({ text: msg, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // Calculate team average tier
  const calcTeamAverageScore = (slots) => {
    const filled = slots.filter(Boolean);
    if (filled.length === 0) return 35;
    const total = filled.reduce((acc, p) => acc + getTierScore(p.highestTier || p.currentTier), 0);
    return total / filled.length;
  };

  const team1AvgScore = calcTeamAverageScore(team1Slots);
  const team2AvgScore = calcTeamAverageScore(team2Slots);
  const team1TierName = getScoreTierName(team1AvgScore);
  const team2TierName = getScoreTierName(team2AvgScore);

  // Open modal for selecting 10 players
  const handleOpenRosterModal = () => {
    const currentTenIds = [
      ...pool,
      ...team1Slots.filter(Boolean),
      ...team2Slots.filter(Boolean),
    ].map(p => p.id);
    setSelectedRosterIds(currentTenIds);
    setIsRosterModalOpen(true);
  };

  const handleTogglePlayerSelection = (playerId) => {
    if (selectedRosterIds.includes(playerId)) {
      setSelectedRosterIds(prev => prev.filter(id => id !== playerId));
    } else {
      if (selectedRosterIds.length >= 10) {
        showFeedback('⚠️ 최대 10명까지만 선택할 수 있습니다.', 'warning');
        return;
      }
      setSelectedRosterIds(prev => [...prev, playerId]);
    }
  };

  const handleApplyRoster = () => {
    if (selectedRosterIds.length !== 10) {
      showFeedback('⚠️ 정확히 10명의 선수를 선택해 주세요.', 'warning');
      return;
    }

    const candidateList = allPlayers && allPlayers.length > 0 ? allPlayers : DEFAULT_PLAYERS;
    const chosen = selectedRosterIds.map(id => candidateList.find(p => p.id === id)).filter(Boolean);

    setPool(sortByHighestTier(chosen));
    setTeam1Slots([null, null, null, null, null]);
    setTeam2Slots([null, null, null, null, null]);
    setPickHistory([]);
    setIsRosterModalOpen(false);
    showFeedback('👥 선택한 10명의 선수가 대기실로 배치되었습니다!', 'success');
  };

  const filteredAllPlayers = sortByHighestTier(
    (allPlayers && allPlayers.length > 0 ? allPlayers : DEFAULT_PLAYERS).filter(p =>
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.nickname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.highestTier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.currentTier || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="team-draft-page">
      {/* Top Banner & Control Bar */}
      <div className="page-title-section draft-title-section">
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>⚔️</span> 1팀 vs 2팀 스네이크 드래프트
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            픽 순서: <strong>팀장 선출 ➔ 1팀 ➔ 2팀 ➔ 2팀 ➔ 1팀 ➔ 1팀 ➔ 2팀 ➔ 2팀 ➔ 1팀</strong> (블루/레드는 마지막에 결정)
          </p>
        </div>

        {/* Action Controls */}
        <div className="draft-action-buttons">
          {pickHistory.length > 0 && (
            <button className="draft-btn" onClick={handleUndoLastPick} title="직전 픽 취소">
              ↩️ 직전 픽 취소
            </button>
          )}
          <button className="draft-btn" onClick={initDraftPool} title="대기열 현황 또는 기본 명단으로 재설정">
            📥 로비 10명 불러오기
          </button>
          <button className="draft-btn" onClick={handleOpenRosterModal} title="DB에서 원하는 10명 선택">
            👥 선수 교체 (10명)
          </button>
          <button className="draft-btn highlight-gold" onClick={handleBalanceTeam} title="팀장 2명 및 1~4픽 최고티어 최적 밸런스 배정">
            ⚖️ AI 티어 밸런스 배정
          </button>
          <button className="draft-btn" onClick={handleRandomShuffle} title="무작위 5:5 셔플">
            🔀 랜덤 셔플
          </button>
          <button className="draft-btn danger-btn" onClick={handleResetAll} title="모든 선수를 대기실로 복귀">
            🔄 전체 초기화
          </button>
        </div>
      </div>

      {/* Alert Notification Toast */}
      {statusMessage && (
        <div className={`hex-card draft-toast ${statusMessage.type}`}>
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* DRAFT TURN & SEQUENCE TIMELINE */}
      <div className="hex-card draft-sequence-container">
        <div className="sequence-header-row">
          <div className="current-turn-banner">
            {currentTarget ? (
              <div className={`turn-alert-box ${currentTarget.team === 1 ? 'team1-active' : 'team2-active'}`}>
                <span className="pulsing-dot">●</span>
                <span className="turn-step-badge">
                  {currentTarget.type === 'CAPTAIN' ? '1단계: 팀장 선출' : `2단계: ${currentTarget.label}`}
                </span>
                <span className="turn-main-instruction">
                  👉 <strong>{currentTarget.team === 1 ? '1팀' : '2팀'}</strong> ({currentTarget.type === 'CAPTAIN' ? '👑 팀장' : currentTarget.slotRole}) 선수를 아래 대기실에서 클릭하세요!
                </span>
              </div>
            ) : (
              <div className="turn-alert-box completed">
                <span>🎉 <strong>10명 팀 배정 완료!</strong> 이제 아래에서 진영(블루/레드)을 확정하세요.</span>
              </div>
            )}
          </div>
        </div>

        {/* 10-Step Visual Timeline Tiles */}
        <div className="timeline-tiles-wrapper">
          {/* Captain 1 */}
          <div className={`timeline-tile ${team1Slots[0] ? 'done' : (!team1Slots[0] ? 'current' : '')}`}>
            <span className="tile-step">C1</span>
            <span className="tile-label">1팀 팀장</span>
            <span className="tile-player">{team1Slots[0] ? team1Slots[0].name : '선택 중'}</span>
          </div>

          {/* Captain 2 */}
          <div className={`timeline-tile ${team2Slots[0] ? 'done' : (team1Slots[0] && !team2Slots[0] ? 'current' : '')}`}>
            <span className="tile-step">C2</span>
            <span className="tile-label">2팀 팀장</span>
            <span className="tile-player">{team2Slots[0] ? team2Slots[0].name : '대기'}</span>
          </div>

          <div className="timeline-divider" />

          {/* 8 Snake Draft Steps */}
          {DRAFT_SEQUENCE.map((seq) => {
            const isFilled = seq.team === 1 ? !!team1Slots[seq.slotIndex] : !!team2Slots[seq.slotIndex];
            const isCurrent = currentTarget?.step === seq.step;
            const assignedPlayer = seq.team === 1 ? team1Slots[seq.slotIndex] : team2Slots[seq.slotIndex];

            return (
              <div
                key={seq.step}
                className={`timeline-tile ${seq.team === 1 ? 'team1-tile' : 'team2-tile'} ${isFilled ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
              >
                <span className="tile-step">{seq.step}픽</span>
                <span className="tile-label">{seq.label}</span>
                <span className="tile-player">{assignedPlayer ? assignedPlayer.name : '-'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: 10 PLAYERS WAITING POOL (UNASSIGNED) */}
      <div className="hex-card draft-pool-card">
        <div className="draft-pool-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ color: 'var(--gold-primary)', fontSize: '1.15rem' }}>
              👤 선수 대기실 ({pool.length}명)
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {currentTarget ? (
                `클릭하면 [${currentTarget.team === 1 ? '1팀' : '2팀'} ${currentTarget.type === 'CAPTAIN' ? '팀장' : currentTarget.slotRole}] 슬롯으로 바로 들어갑니다.`
              ) : (
                '모든 선수가 배정되었습니다.'
              )}
            </span>
          </div>
          {pool.length > 0 && (
            <span className="pool-count-badge">대기 {pool.length}명</span>
          )}
        </div>

        {pool.length > 0 ? (
          <div className="players-icon-grid">
            {pool.map((player, idx) => {
              const highestTier = player.highestTier || player.currentTier || '언랭';
              const tierColor = getTierColor(highestTier);
              const avatarSrc = getAvatarUrl(player.name, idx);

              return (
                <div
                  key={player.id || idx}
                  className="player-icon-card"
                  onClick={() => handlePlayerClick(player)}
                  title={currentTarget ? `클릭 시 ${currentTarget.team === 1 ? '1팀' : '2팀'}으로 배정` : '배정 완료'}
                >
                  {/* Top Avatar with Tier Border */}
                  <div className="icon-avatar-wrapper" style={{ borderColor: tierColor, boxShadow: `0 0 12px ${tierColor}50` }}>
                    <img
                      src={avatarSrc}
                      alt={player.name}
                      className="icon-avatar-img"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="avatar-fallback" style={{ display: 'none', backgroundColor: tierColor }}>
                      {player.name ? player.name.slice(0, 1) : 'P'}
                    </div>
                  </div>

                  {/* Player Names & Meta */}
                  <div className="icon-player-info">
                    <span className="icon-player-name">{player.name}</span>
                    <span className="icon-player-nick">{player.nickname?.split('#')[0] || player.nickname}</span>
                    
                    {/* Highest Tier Badge */}
                    <div style={{ marginBottom: '0.35rem' }}>
                      <span
                        className="icon-tier-badge"
                        style={{
                          color: tierColor,
                          borderColor: `${tierColor}80`,
                          fontWeight: '800',
                          fontSize: '0.75rem',
                          background: 'rgba(0,0,0,0.4)',
                          padding: '2px 7px'
                        }}
                      >
                        👑 {highestTier}
                      </span>
                    </div>

                    {player.currentTier && player.currentTier !== highestTier && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        현: {player.currentTier}
                      </span>
                    )}

                    {/* Lane Dots */}
                    <div className="icon-lane-dots">
                      <span className={`lane-mini ${player.lineTop ? 'on' : ''}`}>T</span>
                      <span className={`lane-mini ${player.lineJungle ? 'on' : ''}`}>J</span>
                      <span className={`lane-mini ${player.lineMid ? 'on' : ''}`}>M</span>
                      <span className={`lane-mini ${player.lineAd ? 'on' : ''}`}>A</span>
                      <span className={`lane-mini ${player.lineSupport ? 'on' : ''}`}>S</span>
                    </div>
                  </div>

                  {/* Quick Pick Buttons */}
                  <div className="icon-card-actions">
                    <button
                      className="mini-move-btn team1-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Find first empty slot in team 1
                        const emptyIdx = team1Slots.findIndex(s => s === null);
                        if (emptyIdx === -1) {
                          showFeedback('1팀 슬롯이 가득 찼습니다.', 'warning');
                          return;
                        }
                        assignPlayerToSlot(player, 1, emptyIdx);
                      }}
                      title="1팀의 다음 빈 슬롯으로 배정"
                      disabled={team1Slots.every(Boolean)}
                    >
                      1팀 배정
                    </button>
                    <button
                      className="mini-move-btn team2-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Find first empty slot in team 2
                        const emptyIdx = team2Slots.findIndex(s => s === null);
                        if (emptyIdx === -1) {
                          showFeedback('2팀 슬롯이 가득 찼습니다.', 'warning');
                          return;
                        }
                        assignPlayerToSlot(player, 2, emptyIdx);
                      }}
                      title="2팀의 다음 빈 슬롯으로 배정"
                      disabled={team2Slots.every(Boolean)}
                    >
                      2팀 배정
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pool-empty-placeholder">
            <span>🎉 모든 선수가 1팀과 2팀에 배정되었습니다!</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              선수를 다시 빼내려면 아래 팀 슬롯에서 선수 카드를 클릭하세요.
            </span>
          </div>
        )}
      </div>

      {/* SECTION 2: 1팀 vs 2팀 SLOTS CONTAINER */}
      <div className="teams-battle-container">
        {/* TEAM 1 (1팀) */}
        <div className={`hex-card team-panel team1-panel ${team1Side === 'BLUE' ? 'side-blue-border' : 'side-red-border'}`}>
          <div className="team-panel-header">
            <div className="team-title-row">
              <span className="team-side-indicator" style={{ color: team1Side === 'BLUE' ? 'var(--blue-primary)' : 'var(--red-primary)' }}>
                {team1Side === 'BLUE' ? '🔵 블루' : '🔴 레드'}
              </span>
              <h3>1팀</h3>
              <span className="team-slot-badge">{team1Slots.filter(Boolean).length} / 5</span>
            </div>
            <div className="team-stats-summary">
              <span>평균 최고티어: <strong>{team1TierName}</strong></span>
            </div>
          </div>

          <div className="team-slots-list">
            {SLOT_ROLES.map((role, slotIdx) => {
              const player = team1Slots[slotIdx];
              const roleIcon = SLOT_ICONS[role];
              const playerHighest = player ? (player.highestTier || player.currentTier || '언랭') : '';
              const playerColor = player ? getTierColor(playerHighest) : '#a09c90';
              const isTargetSlot = currentTarget?.team === 1 && currentTarget?.slotIndex === slotIdx;

              return (
                <div
                  key={`t1-${slotIdx}`}
                  className={`team-slot-item ${player ? 'filled' : 'empty'} ${isTargetSlot ? 'active-target-slot' : ''}`}
                  onClick={() => player && handleRemoveFromSlot(1, slotIdx)}
                  title={player ? '클릭 시 대기실로 복귀' : (isTargetSlot ? '현재 픽 대상 슬롯입니다' : '대기')}
                >
                  <div className="slot-pos-badge" title={role}>
                    <span className="pos-icon">{roleIcon}</span>
                    <span className="pos-name">{role}</span>
                  </div>

                  {player ? (
                    <div className="slot-player-content">
                      <div className="slot-player-avatar" style={{ borderColor: playerColor }}>
                        <img src={getAvatarUrl(player.name, slotIdx)} alt="" />
                      </div>
                      <div className="slot-player-details">
                        <div className="slot-name-row">
                          <span className="slot-player-name">{player.name}</span>
                          <span className="slot-player-tier" style={{ color: playerColor, fontWeight: '800' }}>
                            👑 {playerHighest}
                          </span>
                        </div>
                        <span className="slot-player-nick">{player.nickname}</span>
                      </div>

                      {/* Hover action to remove */}
                      <div className="slot-hover-actions">
                        <button
                          className="slot-action-btn remove-btn"
                          onClick={(e) => handleRemoveFromSlot(1, slotIdx, e)}
                          title="대기실로 복귀"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="slot-empty-content">
                      <span style={{ color: isTargetSlot ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
                        {isTargetSlot ? '👉 지금 이 슬롯을 선택할 차례!' : `${role} 슬롯 대기 중...`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER VERSUS & FINAL SIDE SELECTION */}
        <div className="center-versus-panel">
          <div className="versus-badge">VS</div>

          {/* SIDE SELECTION (블루/레드는 맨 마지막에 정하기) */}
          <div className="hex-card final-side-selection-card">
            <h4 style={{ color: 'var(--gold-primary)', fontSize: '0.95rem', marginBottom: '0.6rem', textAlign: 'center' }}>
              🛡️ 진영 선택 (블루 / 레드)
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '0.9rem' }}>
              팀을 다 짠 후 1팀과 2팀의 진영을 최종 결정하세요.
            </p>

            <div className="side-matchup-visual">
              <div className={`side-badge-pill ${team1Side === 'BLUE' ? 'blue-side-pill' : 'red-side-pill'}`}>
                <span>1팀: {team1Side === 'BLUE' ? '🔵 블루' : '🔴 레드'}</span>
              </div>
              <span style={{ fontWeight: '800', color: 'var(--text-muted)' }}>VS</span>
              <div className={`side-badge-pill ${team2Side === 'BLUE' ? 'blue-side-pill' : 'red-side-pill'}`}>
                <span>2팀: {team2Side === 'BLUE' ? '🔵 블루' : '🔴 레드'}</span>
              </div>
            </div>

            <div className="side-action-btn-row">
              <button
                className="btn-side-toggle"
                onClick={toggleTeamSides}
                title="1팀과 2팀의 블루/레드 진영을 서로 맞바꿉니다."
              >
                🔄 진영 맞바꾸기
              </button>
              <button
                className="btn-side-toggle"
                onClick={handleCoinTossSide}
                title="50% 확률로 1팀의 진영을 랜덤 추첨합니다."
              >
                🎲 코인 토스 추첨
              </button>
            </div>
          </div>

          {/* Final Match Creation Button */}
          <div className="draft-submit-box">
            <button
              className={`btn-confirm-match ${isAllFilled ? 'ready' : 'disabled'}`}
              disabled={!isAllFilled || isSubmitting}
              onClick={handleConfirmMatch}
            >
              {isSubmitting ? (
                '⏳ 매치 생성 중...'
              ) : isAllFilled ? (
                '⚔️ 팀 & 진영 확정 ➔ 매치 시작!'
              ) : (
                `드래프트 진행 중 (${team1Slots.filter(Boolean).length + team2Slots.filter(Boolean).length}/10)`
              )}
            </button>

            {lobby && (
              <button className="btn-sync-lobby" onClick={handleSyncToLobby}>
                📋 대기열/구글 시트에 팀 임시 저장
              </button>
            )}
          </div>
        </div>

        {/* TEAM 2 (2팀) */}
        <div className={`hex-card team-panel team2-panel ${team2Side === 'BLUE' ? 'side-blue-border' : 'side-red-border'}`}>
          <div className="team-panel-header">
            <div className="team-title-row">
              <span className="team-side-indicator" style={{ color: team2Side === 'BLUE' ? 'var(--blue-primary)' : 'var(--red-primary)' }}>
                {team2Side === 'BLUE' ? '🔵 블루' : '🔴 레드'}
              </span>
              <h3>2팀</h3>
              <span className="team-slot-badge">{team2Slots.filter(Boolean).length} / 5</span>
            </div>
            <div className="team-stats-summary">
              <span>평균 최고티어: <strong>{team2TierName}</strong></span>
            </div>
          </div>

          <div className="team-slots-list">
            {SLOT_ROLES.map((role, slotIdx) => {
              const player = team2Slots[slotIdx];
              const roleIcon = SLOT_ICONS[role];
              const playerHighest = player ? (player.highestTier || player.currentTier || '언랭') : '';
              const playerColor = player ? getTierColor(playerHighest) : '#a09c90';
              const isTargetSlot = currentTarget?.team === 2 && currentTarget?.slotIndex === slotIdx;

              return (
                <div
                  key={`t2-${slotIdx}`}
                  className={`team-slot-item ${player ? 'filled' : 'empty'} ${isTargetSlot ? 'active-target-slot' : ''}`}
                  onClick={() => player && handleRemoveFromSlot(2, slotIdx)}
                  title={player ? '클릭 시 대기실로 복귀' : (isTargetSlot ? '현재 픽 대상 슬롯입니다' : '대기')}
                >
                  <div className="slot-pos-badge" title={role}>
                    <span className="pos-icon">{roleIcon}</span>
                    <span className="pos-name">{role}</span>
                  </div>

                  {player ? (
                    <div className="slot-player-content">
                      <div className="slot-player-avatar" style={{ borderColor: playerColor }}>
                        <img src={getAvatarUrl(player.name, slotIdx + 5)} alt="" />
                      </div>
                      <div className="slot-player-details">
                        <div className="slot-name-row">
                          <span className="slot-player-name">{player.name}</span>
                          <span className="slot-player-tier" style={{ color: playerColor, fontWeight: '800' }}>
                            👑 {playerHighest}
                          </span>
                        </div>
                        <span className="slot-player-nick">{player.nickname}</span>
                      </div>

                      {/* Hover action to remove */}
                      <div className="slot-hover-actions">
                        <button
                          className="slot-action-btn remove-btn"
                          onClick={(e) => handleRemoveFromSlot(2, slotIdx, e)}
                          title="대기실로 복귀"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="slot-empty-content">
                      <span style={{ color: isTargetSlot ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
                        {isTargetSlot ? '👉 지금 이 슬롯을 선택할 차례!' : `${role} 슬롯 대기 중...`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROSTER SELECTION MODAL */}
      {isRosterModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsRosterModalOpen(false)}>
          <div className="hex-card roster-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👥 내전 참가 소환사 10명 선택 ({selectedRosterIds.length}/10)</h3>
              <button className="modal-close-btn" onClick={() => setIsRosterModalOpen(false)}>✕</button>
            </div>

            <div className="modal-search-bar">
              <input
                type="text"
                placeholder="🔎 이름, 닉네임, 최고티어 검색..."
                className="password-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="roster-modal-list">
              {filteredAllPlayers.map(p => {
                const isSelected = selectedRosterIds.includes(p.id);
                const highestTier = p.highestTier || p.currentTier || '언랭';
                const tierColor = getTierColor(highestTier);

                return (
                  <div
                    key={p.id}
                    className={`roster-select-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleTogglePlayerSelection(p.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="roster-checkbox"
                    />
                    <span className="roster-name">{p.name}</span>
                    <span className="roster-nick">{p.nickname}</span>
                    <span className="roster-tier" style={{ color: tierColor, fontWeight: '800' }}>
                      👑 {highestTier}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', width: '80px', textAlign: 'right' }}>
                      {p.currentTier ? `현: ${p.currentTier}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="modal-footer">
              <span style={{ fontSize: '0.85rem', color: selectedRosterIds.length === 10 ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
                {selectedRosterIds.length === 10 ? '✅ 10명이 정확히 선택되었습니다.' : `10명을 맞춰주세요 (현재 ${selectedRosterIds.length}명)`}
              </span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="draft-btn" onClick={() => setIsRosterModalOpen(false)}>
                  취소
                </button>
                <button
                  className="draft-btn highlight-gold"
                  disabled={selectedRosterIds.length !== 10}
                  onClick={handleApplyRoster}
                >
                  선택한 10명 적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamDraft;
