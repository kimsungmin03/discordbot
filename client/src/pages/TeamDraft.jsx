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

// Slot roles (팀장, 1픽, 2픽, 3픽, 4픽)
const SLOT_ROLES = ['팀장', '1픽', '2픽', '3픽', '4픽'];

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

// Player position text helper
const getPlayerPositionText = (p) => {
  if (!p) return '-';
  if (p.mainPosition) {
    const sub = [];
    if (p.lineTop && p.mainPosition !== '탑') sub.push('탑');
    if (p.lineJungle && p.mainPosition !== '정글') sub.push('정글');
    if (p.lineMid && p.mainPosition !== '미드') sub.push('미드');
    if (p.lineAd && p.mainPosition !== '원딜') sub.push('원딜');
    if (p.lineSupport && p.mainPosition !== '서폿') sub.push('서폿');
    if (sub.length > 0) return `${p.mainPosition}(${sub.join(',')})`;
    return p.mainPosition;
  }
  const lines = [];
  if (p.lineTop) lines.push('탑');
  if (p.lineJungle) lines.push('정글');
  if (p.lineMid) lines.push('미드');
  if (p.lineAd) lines.push('원딜');
  if (p.lineSupport) lines.push('서폿');
  return lines.length > 0 ? lines.join('/') : '-';
};

// Position badge color
const getPositionColor = (posStr) => {
  if (!posStr) return '#8ea2b4';
  if (posStr.startsWith('탑')) return '#b388ff';
  if (posStr.startsWith('정글')) return '#00e676';
  if (posStr.startsWith('미드')) return '#ffab00';
  if (posStr.startsWith('원딜')) return '#00b0ff';
  if (posStr.startsWith('서폿')) return '#ff4081';
  return '#8ea2b4';
};

function TeamDraft({ lobby, allPlayers, onNavigateTab }) {
  // 10 Fixed Players (Table: 2 rows of 5 players)
  const [rosterPlayers, setRosterPlayers] = useState([]);

  // 1팀(블루) 선수 5 slots: [팀장, 1픽, 2픽, 3픽, 4픽]
  const [team1Slots, setTeam1Slots] = useState([null, null, null, null, null]);
  // 2팀(레드) 선수 5 slots: [팀장, 1픽, 2픽, 3픽, 4픽]
  const [team2Slots, setTeam2Slots] = useState([null, null, null, null, null]);

  // History stack for Undo
  const [pickHistory, setPickHistory] = useState([]);

  // Roster modal
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [selectedRosterIds, setSelectedRosterIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Status message & UI state
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Sort helper by highestTier
  const sortByHighestTier = (list) => {
    return [...list].sort((a, b) => {
      const scoreA = getTierScore(a.highestTier || a.currentTier);
      const scoreB = getTierScore(b.highestTier || b.currentTier);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return (b.wins || 0) - (a.wins || 0);
    });
  };

  // Determine current draft target slot
  const getCurrentDraftTarget = () => {
    if (!team1Slots[0]) {
      return { type: 'CAPTAIN', team: 1, slotIndex: 0, label: '1팀 팀장' };
    }
    if (!team2Slots[0]) {
      return { type: 'CAPTAIN', team: 2, slotIndex: 0, label: '2팀 팀장' };
    }

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

    return null; // All 10 picked
  };

  const currentTarget = getCurrentDraftTarget();

  // Initialize roster (10 players)
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

    const sortedTen = sortByHighestTier(source);
    setRosterPlayers(sortedTen);
    setTeam1Slots([null, null, null, null, null]);
    setTeam2Slots([null, null, null, null, null]);
    setPickHistory([]);
  };

  // Check which team a player is assigned to
  const getPlayerAssignment = (player) => {
    const t1Idx = team1Slots.findIndex(p => p && p.id === player.id);
    if (t1Idx !== -1) return { team: 1, slotIdx: t1Idx, role: SLOT_ROLES[t1Idx] };
    const t2Idx = team2Slots.findIndex(p => p && p.id === player.id);
    if (t2Idx !== -1) return { team: 2, slotIdx: t2Idx, role: SLOT_ROLES[t2Idx] };
    return null;
  };

  // Click on a player card:
  // If not assigned: assign to current draft turn slot
  // If already assigned: remove from team
  const handlePlayerCardClick = (player) => {
    const assignment = getPlayerAssignment(player);
    if (assignment) {
      handleRemoveFromSlot(assignment.team, assignment.slotIdx);
      return;
    }

    if (!currentTarget) {
      showFeedback('10명 배정이 이미 완료되었습니다.', 'info');
      return;
    }
    assignPlayerToSlot(player, currentTarget.team, currentTarget.slotIndex);
  };

  // Direct assign to specific team's next empty slot
  const handleAssignToTeam = (player, targetTeam, e) => {
    if (e) e.stopPropagation();
    const assignment = getPlayerAssignment(player);
    if (assignment) return; // already assigned

    const targetSlots = targetTeam === 1 ? team1Slots : team2Slots;
    const emptyIdx = targetSlots.findIndex(s => s === null);
    if (emptyIdx === -1) {
      showFeedback(`${targetTeam}팀 슬롯이 가득 찼습니다.`, 'warning');
      return;
    }

    assignPlayerToSlot(player, targetTeam, emptyIdx);
  };

  // Assign player to specific team slot
  const assignPlayerToSlot = (player, team, slotIdx) => {
    setPickHistory(prev => [...prev, {
      prevTeam1: [...team1Slots],
      prevTeam2: [...team2Slots],
    }]);

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

  // Undo last action
  const handleUndoLastPick = () => {
    if (pickHistory.length === 0) {
      showFeedback('되돌릴 기록이 없습니다.', 'warning');
      return;
    }
    const last = pickHistory[pickHistory.length - 1];
    setTeam1Slots(last.prevTeam1);
    setTeam2Slots(last.prevTeam2);
    setPickHistory(prev => prev.slice(0, -1));
    showFeedback('직전 작업을 되돌렸습니다.', 'info');
  };

  // Remove player from slot back to waiting pool
  const handleRemoveFromSlot = (team, slotIdx, e) => {
    if (e) e.stopPropagation();
    const player = team === 1 ? team1Slots[slotIdx] : team2Slots[slotIdx];
    if (!player) return;

    setPickHistory(prev => [...prev, {
      prevTeam1: [...team1Slots],
      prevTeam2: [...team2Slots],
    }]);

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
  };

  // Swap Teams: 1팀(블루)와 2팀(레드)의 팀원 전체를 맞바꿈
  const handleSwapTeams = () => {
    setPickHistory(prev => [...prev, {
      prevTeam1: [...team1Slots],
      prevTeam2: [...team2Slots],
    }]);

    const temp1 = [...team1Slots];
    const temp2 = [...team2Slots];
    setTeam1Slots(temp2);
    setTeam2Slots(temp1);
    showFeedback('1팀(블루)와 2팀(레드)의 팀원을 맞바꿨습니다.', 'info');
  };

  // Reset all assignments
  const handleResetAll = () => {
    setTeam1Slots([null, null, null, null, null]);
    setTeam2Slots([null, null, null, null, null]);
    setPickHistory([]);
    showFeedback('모든 선수가 대기 상태로 복귀했습니다.', 'info');
  };

  // AI Tier Balance
  const handleBalanceTeam = () => {
    if (rosterPlayers.length < 10) {
      showFeedback('총 10명의 선수가 필요합니다.', 'warning');
      return;
    }

    const tenPlayers = sortByHighestTier(rosterPlayers.slice(0, 10));
    const cap1 = tenPlayers[0];
    const cap2 = tenPlayers[1];
    const remaining = tenPlayers.slice(2);

    const tierScores = remaining.map(p => getTierScore(p.highestTier || p.currentTier));

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

    const sortedT1Picks = sortByHighestTier(t1Picks);
    const sortedT2Picks = sortByHighestTier(t2Picks);

    setPickHistory(prev => [...prev, {
      prevTeam1: [...team1Slots],
      prevTeam2: [...team2Slots],
    }]);

    setTeam1Slots([cap1, sortedT1Picks[0], sortedT1Picks[1], sortedT1Picks[2], sortedT1Picks[3]]);
    setTeam2Slots([cap2, sortedT2Picks[0], sortedT2Picks[1], sortedT2Picks[2], sortedT2Picks[3]]);
    showFeedback('최고 티어 기준 최적 밸런스로 배정되었습니다.', 'success');
  };

  // Random Shuffle
  const handleRandomShuffle = () => {
    if (rosterPlayers.length < 10) {
      showFeedback('총 10명의 선수가 필요합니다.', 'warning');
      return;
    }
    const shuffled = [...rosterPlayers].sort(() => Math.random() - 0.5);

    setPickHistory(prev => [...prev, {
      prevTeam1: [...team1Slots],
      prevTeam2: [...team2Slots],
    }]);

    setTeam1Slots(shuffled.slice(0, 5));
    setTeam2Slots(shuffled.slice(5, 10));
    showFeedback('무작위 5:5 셔플이 완료되었습니다.', 'success');
  };

  // Check if all slots filled
  const isAllFilled = team1Slots.every(Boolean) && team2Slots.every(Boolean);

  // Generate copy string:
  // 1팀(블루)\n이름1\n이름2\n이름3\n이름4\n이름5\n2팀(레드)\n이름1\n이름2\n이름3\n이름4\n이름5
  const getTeamCopyText = () => {
    const t1Names = team1Slots.map(p => (p ? p.name : '(미정)'));
    const t2Names = team2Slots.map(p => (p ? p.name : '(미정)'));
    return `1팀(블루)\n${t1Names.join('\n')}\n2팀(레드)\n${t2Names.join('\n')}`;
  };

  // Copy teams text to clipboard
  const handleCopyTeams = async () => {
    const text = getTeamCopyText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setIsCopied(true);
      showFeedback('팀 명단이 클립보드에 복사되었습니다!', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      showFeedback('복사에 실패했습니다.', 'error');
    }
  };

  // Confirm and start match (1팀=블루, 2팀=레드 고정)
  const handleConfirmMatch = async () => {
    if (!isAllFilled) {
      showFeedback('1팀과 2팀 모두 5명씩 채워져야 매치를 시작할 수 있습니다.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const blueTeamNames = team1Slots.map(p => p.name);
      const redTeamNames = team2Slots.map(p => p.name);

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

      showFeedback(`매치 #${data.match.id} 생성 완료!`, 'success');

      if (onNavigateTab) {
        setTimeout(() => {
          onNavigateTab('matchup');
        }, 1200);
      }
    } catch (err) {
      showFeedback(`오류: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sync draft teams to lobby
  const handleSyncToLobby = async () => {
    try {
      const blueTeamNames = team1Slots.filter(Boolean).map(p => p.name);
      const redTeamNames = team2Slots.filter(Boolean).map(p => p.name);

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

      showFeedback('대기열 현황과 구글 시트에 현재 팀 배정이 저장되었습니다.', 'success');
    } catch (err) {
      showFeedback(`동기화 실패: ${err.message}`, 'warning');
    }
  };

  const showFeedback = (msg, type = 'info') => {
    setStatusMessage({ text: msg, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };

  // Calculate team averages
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

  // Roster modal helpers
  const handleOpenRosterModal = () => {
    const currentTenIds = rosterPlayers.map(p => p.id);
    setSelectedRosterIds(currentTenIds);
    setIsRosterModalOpen(true);
  };

  const handleTogglePlayerSelection = (playerId) => {
    if (selectedRosterIds.includes(playerId)) {
      setSelectedRosterIds(prev => prev.filter(id => id !== playerId));
    } else {
      if (selectedRosterIds.length >= 10) {
        showFeedback('최대 10명까지만 선택할 수 있습니다.', 'warning');
        return;
      }
      setSelectedRosterIds(prev => [...prev, playerId]);
    }
  };

  const handleApplyRoster = () => {
    if (selectedRosterIds.length !== 10) {
      showFeedback('정확히 10명의 선수를 선택해 주세요.', 'warning');
      return;
    }

    const candidateList = allPlayers && allPlayers.length > 0 ? allPlayers : DEFAULT_PLAYERS;
    const chosen = selectedRosterIds.map(id => candidateList.find(p => p.id === id)).filter(Boolean);

    setRosterPlayers(sortByHighestTier(chosen));
    setTeam1Slots([null, null, null, null, null]);
    setTeam2Slots([null, null, null, null, null]);
    setPickHistory([]);
    setIsRosterModalOpen(false);
    showFeedback('선택한 10명이 대기실로 배치되었습니다.', 'success');
  };

  const filteredAllPlayers = sortByHighestTier(
    (allPlayers && allPlayers.length > 0 ? allPlayers : DEFAULT_PLAYERS).filter(p =>
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.nickname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.highestTier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.currentTier || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Count unassigned players
  const unassignedCount = rosterPlayers.filter(p => !getPlayerAssignment(p)).length;

  return (
    <div className="team-draft-page compact-layout">
      {/* Top Header & Action Bar */}
      <div className="draft-top-bar">
        <div className="draft-title-compact">
          <h2>1팀(블루) vs 2팀(레드) 드래프트</h2>
        </div>

        <div className="draft-action-buttons compact-buttons">
          {pickHistory.length > 0 && (
            <button className="draft-btn sm" onClick={handleUndoLastPick} title="직전 작업 되돌리기">
              되돌리기
            </button>
          )}
          <button className="draft-btn sm" onClick={initDraftPool} title="로비 인원 또는 기본 명단으로 재설정">
            로비 불러오기
          </button>
          <button className="draft-btn sm" onClick={handleOpenRosterModal} title="DB에서 10명 선택">
            선수 교체
          </button>
          <button className="draft-btn sm highlight-gold" onClick={handleBalanceTeam} title="최고티어 기준 AI 밸런스 배정">
            AI 밸런스 배정
          </button>
          <button className="draft-btn sm" onClick={handleRandomShuffle} title="랜덤 5:5 셔플">
            랜덤 셔플
          </button>
          <button className="draft-btn sm danger-btn" onClick={handleResetAll} title="대기실로 전체 복귀">
            초기화
          </button>
        </div>
      </div>

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div className={`draft-toast-bar ${statusMessage.type}`}>
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Turn Indicator Strip */}
      <div className="draft-turn-strip">
        {currentTarget ? (
          <div className={`turn-strip-content ${currentTarget.team === 1 ? 'team1-turn' : 'team2-turn'}`}>
            <span className="turn-badge">
              {currentTarget.type === 'CAPTAIN' ? '팀장 선출' : currentTarget.label}
            </span>
            <span className="turn-guide">
              <strong>{currentTarget.team === 1 ? '1팀(블루)' : '2팀(레드)'}</strong> ({currentTarget.type === 'CAPTAIN' ? '팀장' : currentTarget.slotRole}) 선수를 아래 10명 명단에서 선택하거나 [1팀]/[2팀] 버튼을 누르세요.
            </span>
          </div>
        ) : (
          <div className="turn-strip-content completed">
            <span className="turn-badge done">배정 완료</span>
            <span className="turn-guide">10명 팀 배정이 완료되었습니다! 가운데 [팀 복사] 칸에서 명단을 복사하세요.</span>
          </div>
        )}
      </div>

      {/* SECTION 1: 10 Fixed Players (Table: 2 rows x 5 columns) */}
      <div className="draft-pool-compact fixed-table-pool">
        <div className="pool-strip-header">
          <span className="pool-label">선수 명단 (2줄 5명 고정 / 대기: {unassignedCount}명)</span>
          {currentTarget && unassignedCount > 0 && (
            <span className="pool-subtext">카드를 클릭하면 현재 차례로 배정되며, 1팀/2팀 버튼으로 직접 지정할 수 있습니다.</span>
          )}
        </div>

        <div className="draft-roster-grid">
          {rosterPlayers.map((player) => {
            const tier = player.highestTier || player.currentTier || '언랭';
            const tierColor = getTierColor(tier);
            const assignment = getPlayerAssignment(player);

            // 5 Lanes active status
            const isTop = !!(player.lineTop || player.mainPosition === '탑');
            const isJg = !!(player.lineJungle || player.mainPosition === '정글');
            const isMid = !!(player.lineMid || player.mainPosition === '미드');
            const isAd = !!(player.lineAd || player.mainPosition === '원딜');
            const isSup = !!(player.lineSupport || player.mainPosition === '서폿');

            return (
              <div
                key={player.id}
                className={`roster-table-card ${assignment ? (assignment.team === 1 ? 'assigned-t1' : 'assigned-t2') : 'unassigned'}`}
                onClick={() => handlePlayerCardClick(player)}
                title={assignment ? `${assignment.team}팀(${assignment.role}) 배정됨 (클릭 시 취소)` : (currentTarget ? `클릭 시 ${currentTarget.team === 1 ? '1팀(블루)' : '2팀(레드)'}으로 배정` : '')}
              >
                {/* 1행: 이름 / 최고티어 */}
                <div className="card-row-top">
                  <span className="card-player-name">{player.name}</span>
                  <span className="card-sep">/</span>
                  <span className="card-player-tier" style={{ color: tierColor }}>
                    {tier}
                  </span>
                </div>

                {/* 2행: 라인 [5개 다 적고 불켜기] */}
                <div className="card-row-lanes">
                  <span className={`lane-pill ${isTop ? 'on top-on' : 'off'}`}>탑</span>
                  <span className={`lane-pill ${isJg ? 'on jg-on' : 'off'}`}>정글</span>
                  <span className={`lane-pill ${isMid ? 'on mid-on' : 'off'}`}>미드</span>
                  <span className={`lane-pill ${isAd ? 'on ad-on' : 'off'}`}>원딜</span>
                  <span className={`lane-pill ${isSup ? 'on sup-on' : 'off'}`}>서폿</span>
                </div>

                {/* 3행: 1팀 2팀 버튼 or 배정 상태 */}
                <div className="card-row-bottom">
                  {!assignment ? (
                    <div className="card-action-btns">
                      <button
                        className="card-team-btn btn-t1"
                        onClick={(e) => handleAssignToTeam(player, 1, e)}
                        disabled={team1Slots.every(Boolean)}
                        title="1팀(블루) 빈 슬롯으로 배정"
                      >
                        1팀
                      </button>
                      <button
                        className="card-team-btn btn-t2"
                        onClick={(e) => handleAssignToTeam(player, 2, e)}
                        disabled={team2Slots.every(Boolean)}
                        title="2팀(레드) 빈 슬롯으로 배정"
                      >
                        2팀
                      </button>
                    </div>
                  ) : (
                    <div className={`card-assigned-status ${assignment.team === 1 ? 'status-t1' : 'status-t2'}`}>
                      <span className="assigned-badge">
                        {assignment.team === 1 ? '1팀' : '2팀'} ({assignment.role})
                      </span>
                      <button
                        className="card-cancel-x"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromSlot(assignment.team, assignment.slotIdx, e);
                        }}
                        title="배정 취소"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: 1팀(블루) vs Center Control vs 2팀(레드) */}
      <div className="draft-main-grid">
        {/* TEAM 1 (BLUE) */}
        <div className="team-compact-card team1-card">
          <div className="team-compact-header header-blue">
            <div className="team-name-tag">
              <span className="team-side-tag blue-tag">1팀 (블루)</span>
              <span className="team-count">({team1Slots.filter(Boolean).length}/5)</span>
            </div>
            <span className="team-avg">평균: {team1TierName}</span>
          </div>

          <div className="team-compact-slots">
            {SLOT_ROLES.map((role, idx) => {
              const player = team1Slots[idx];
              const isTarget = currentTarget?.team === 1 && currentTarget?.slotIndex === idx;
              const playerTier = player ? (player.highestTier || player.currentTier || '언랭') : '';
              const playerColor = player ? getTierColor(playerTier) : '#a09c90';
              const posText = player ? getPlayerPositionText(player) : '';
              const posColor = player ? getPositionColor(posText) : '#8ea2b4';

              return (
                <div
                  key={`t1-${idx}`}
                  className={`compact-slot-row ${player ? 'filled' : 'empty'} ${isTarget ? 'target' : ''}`}
                  onClick={() => player && handleRemoveFromSlot(1, idx)}
                  title={player ? '클릭 시 대기실로 복귀' : (isTarget ? '현재 선택할 차례입니다' : '')}
                >
                  <span className="slot-role-label">{role}</span>

                  {player ? (
                    <div className="slot-player-box">
                      <span className="slot-name">{player.name}</span>
                      <span className="slot-pos" style={{ color: posColor, borderColor: `${posColor}50` }}>
                        {posText}
                      </span>
                      <span className="slot-tier" style={{ color: playerColor }}>
                        {playerTier}
                      </span>
                      <button
                        className="slot-del-btn"
                        onClick={(e) => handleRemoveFromSlot(1, idx, e)}
                        title="대기실로 복귀"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span className="slot-placeholder">
                      {isTarget ? '👉 선택 차례' : '대기'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER CONTROLS & COPY BOX */}
        <div className="center-compact-control">
          {/* Swap Teams Button */}
          <button
            className="draft-btn swap-teams-btn"
            onClick={handleSwapTeams}
            title="1팀(블루)과 2팀(레드)의 선수 전체를 맞바꿉니다."
          >
            팀 바꾸기 (1팀 ↔ 2팀 맞교체)
          </button>

          {/* Copy Teams Box: 항상 제공되며 10명 다 뽑았을 때 완벽하게 복사 가능 */}
          <div className="team-copy-container">
            <div className="copy-header-row">
              <button
                className={`btn-copy-action ${isCopied ? 'copied' : ''}`}
                onClick={handleCopyTeams}
              >
                {isCopied ? '[팀 복사 완료!]' : '[팀 복사]'}
              </button>
              <span className="copy-hint">
                {isAllFilled ? '10명 배정 완료 (복사 가능)' : `배정 중 (${team1Slots.filter(Boolean).length + team2Slots.filter(Boolean).length}/10)`}
              </span>
            </div>

            <textarea
              className="team-copy-textarea"
              readOnly
              rows={12}
              value={getTeamCopyText()}
              onClick={(e) => e.target.select()}
              title="클릭 시 전체 선택됩니다."
            />
          </div>

          {/* Match Confirm & Lobby Sync */}
          <div className="center-actions-bottom">
            <button
              className={`btn-match-start ${isAllFilled ? 'ready' : 'disabled'}`}
              disabled={!isAllFilled || isSubmitting}
              onClick={handleConfirmMatch}
            >
              {isSubmitting ? '매치 생성 중...' : isAllFilled ? '매치 시작' : '팀 배정 진행 중'}
            </button>
            {lobby && (
              <button className="draft-btn sm" onClick={handleSyncToLobby} title="현재 팀 배정을 로비 및 구글 시트에 저장">
                로비 동기화
              </button>
            )}
          </div>
        </div>

        {/* TEAM 2 (RED) */}
        <div className="team-compact-card team2-card">
          <div className="team-compact-header header-red">
            <div className="team-name-tag">
              <span className="team-side-tag red-tag">2팀 (레드)</span>
              <span className="team-count">({team2Slots.filter(Boolean).length}/5)</span>
            </div>
            <span className="team-avg">평균: {team2TierName}</span>
          </div>

          <div className="team-compact-slots">
            {SLOT_ROLES.map((role, idx) => {
              const player = team2Slots[idx];
              const isTarget = currentTarget?.team === 2 && currentTarget?.slotIndex === idx;
              const playerTier = player ? (player.highestTier || player.currentTier || '언랭') : '';
              const playerColor = player ? getTierColor(playerTier) : '#a09c90';
              const posText = player ? getPlayerPositionText(player) : '';
              const posColor = player ? getPositionColor(posText) : '#8ea2b4';

              return (
                <div
                  key={`t2-${idx}`}
                  className={`compact-slot-row ${player ? 'filled' : 'empty'} ${isTarget ? 'target' : ''}`}
                  onClick={() => player && handleRemoveFromSlot(2, idx)}
                  title={player ? '클릭 시 대기실로 복귀' : (isTarget ? '현재 선택할 차례입니다' : '')}
                >
                  <span className="slot-role-label">{role}</span>

                  {player ? (
                    <div className="slot-player-box">
                      <span className="slot-name">{player.name}</span>
                      <span className="slot-pos" style={{ color: posColor, borderColor: `${posColor}50` }}>
                        {posText}
                      </span>
                      <span className="slot-tier" style={{ color: playerColor }}>
                        {playerTier}
                      </span>
                      <button
                        className="slot-del-btn"
                        onClick={(e) => handleRemoveFromSlot(2, idx, e)}
                        title="대기실로 복귀"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span className="slot-placeholder">
                      {isTarget ? '👉 선택 차례' : '대기'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROSTER MODAL (10 Players from DB) */}
      {isRosterModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsRosterModalOpen(false)}>
          <div className="hex-card roster-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>선수 10명 선택 ({selectedRosterIds.length}/10)</h3>
              <button className="modal-close-btn" onClick={() => setIsRosterModalOpen(false)}>✕</button>
            </div>

            <div className="modal-search-bar">
              <input
                type="text"
                placeholder="이름, 닉네임, 최고티어 검색..."
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
                const posText = getPlayerPositionText(p);
                const posColor = getPositionColor(posText);

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
                    <span className="roster-pos" style={{ color: posColor }}>{posText}</span>
                    <span className="roster-nick">{p.nickname}</span>
                    <span className="roster-tier" style={{ color: tierColor, fontWeight: '700' }}>
                      {highestTier}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="modal-footer">
              <span style={{ fontSize: '0.85rem', color: selectedRosterIds.length === 10 ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
                {selectedRosterIds.length === 10 ? '10명이 선택되었습니다.' : `10명을 맞춰주세요 (현재 ${selectedRosterIds.length}명)`}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="draft-btn sm" onClick={() => setIsRosterModalOpen(false)}>
                  취소
                </button>
                <button
                  className="draft-btn sm highlight-gold"
                  disabled={selectedRosterIds.length !== 10}
                  onClick={handleApplyRoster}
                >
                  10명 적용
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
