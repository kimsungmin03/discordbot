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

// Default mock players strictly matched to user's design reference
const DEFAULT_PLAYERS = [
  { id: 'p1', name: '임헌진', nickname: 'Lim#KR1', currentTier: '마스터 100+', highestTier: '마스터 100+', mainPosition: '정글', lineJungle: true, lineAd: true },
  { id: 'p2', name: '신동수', nickname: 'Shin#KR1', currentTier: '마스터 000+', highestTier: '마스터 000+', mainPosition: '탑', lineTop: true, lineJungle: true, lineMid: true, lineAd: true },
  { id: 'p3', name: '김민기', nickname: 'Kim#KR1', currentTier: '마스터 500+', highestTier: '마스터 500+', mainPosition: '원딜', lineTop: true, lineAd: true },
  { id: 'p4', name: '안준영', nickname: 'Ahn#KR1', currentTier: '다이아3', highestTier: '다이아3', mainPosition: '미드', lineTop: true, lineMid: true },
  { id: 'p5', name: '박연수', nickname: 'Park#KR1', currentTier: '에메2', highestTier: '에메2', mainPosition: '미드', lineMid: true, lineSupport: true },
  { id: 'p6', name: '고경훈', nickname: 'Ko#KR1', currentTier: '에메3', highestTier: '에메3', mainPosition: '탑', lineTop: true, lineAd: true },
  { id: 'p7', name: '김신의', nickname: 'Shin#KR1', currentTier: '에메3', highestTier: '에메3', mainPosition: '정글', lineJungle: true, lineAd: true },
  { id: 'p8', name: '김성민', nickname: 'Sung#KR1', currentTier: '플레1', highestTier: '플레1', mainPosition: '서폿', lineSupport: true },
  { id: 'p9', name: '이시은', nickname: 'Lee#KR1', currentTier: '골드1', highestTier: '골드1', mainPosition: '원딜', lineAd: true, lineSupport: true },
  { id: 'p10', name: '유희성', nickname: 'Yoo#KR1', currentTier: '골드3', highestTier: '골드3', mainPosition: '미드', lineMid: true },
];

// Slot definitions: 5 slots with standard lane icons
const SLOT_CONFIG = [
  { slotIndex: 0, role: '팀장', lane: '탑' },
  { slotIndex: 1, role: '1픽', lane: '정글' },
  { slotIndex: 2, role: '2픽', lane: '미드' },
  { slotIndex: 3, role: '3픽', lane: '원딜' },
  { slotIndex: 4, role: '4픽', lane: '서폿' },
];

const SLOT_ROLES = ['팀장', '1픽', '2픽', '3픽', '4픽'];

// Standard LoL Snake Draft Sequence:
// 1팀 팀장 -> 2팀 팀장 -> 1팀 1픽 -> 2팀 1픽 -> 2팀 2픽 -> 1팀 2픽 -> 1팀 3픽 -> 2팀 3픽 -> 2팀 4픽 -> 1팀 4픽
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

// Tier badge style helper
const getTierBadgeStyle = (tierStr) => {
  if (!tierStr) return { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
  const t = tierStr.toLowerCase();
  if (t.includes('챌린저')) return { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' };
  if (t.includes('그랜드마스터')) return { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' };
  if (t.includes('마스터')) return { bg: '#faf5ff', color: '#7e22ce', border: '#d8b4fe' };
  if (t.includes('다이아')) return { bg: '#f0f9ff', color: '#0369a1', border: '#7dd3fc' };
  if (t.includes('에메')) return { bg: '#f0fdf4', color: '#15803d', border: '#86efac' };
  if (t.includes('플레')) return { bg: '#f0fdfa', color: '#0f766e', border: '#5eead4' };
  if (t.includes('골드')) return { bg: '#fefce8', color: '#a16207', border: '#fde047' };
  if (t.includes('실버')) return { bg: '#f8fafc', color: '#475569', border: '#cbd5e1' };
  if (t.includes('브론즈')) return { bg: '#fffbeb', color: '#92400e', border: '#fcd34d' };
  if (t.includes('아이언')) return { bg: '#f1f5f9', color: '#334155', border: '#94a3b8' };
  return { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
};

function TeamDraft({ lobby, allPlayers, onNavigateTab }) {
  // 10 Fixed Players (Table: 2 columns x 5 rows as per reference UI)
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
  const [copyFeedback, setCopyFeedback] = useState('');

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
      return { type: 'CAPTAIN', team: 1, slotIndex: 0, label: '1팀 (팀장)' };
    }
    if (!team2Slots[0]) {
      return { type: 'CAPTAIN', team: 2, slotIndex: 0, label: '2팀 (팀장)' };
    }

    for (const seq of DRAFT_SEQUENCE) {
      const targetSlots = seq.team === 1 ? team1Slots : team2Slots;
      if (!targetSlots[seq.slotIndex]) {
        return {
          type: 'PICK',
          team: seq.team,
          slotIndex: seq.slotIndex,
          slotRole: seq.slotRole,
          label: `${seq.team === 1 ? '1팀(블루)' : '2팀(레드)'} (${seq.slotRole})`,
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
    if (t1Idx !== -1) return { team: 1, slotIdx: t1Idx, role: SLOT_CONFIG[t1Idx].role, lane: SLOT_CONFIG[t1Idx].lane };
    const t2Idx = team2Slots.findIndex(p => p && p.id === player.id);
    if (t2Idx !== -1) return { team: 2, slotIdx: t2Idx, role: SLOT_CONFIG[t2Idx].role, lane: SLOT_CONFIG[t2Idx].lane };
    return null;
  };

  // Card click handler
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
    if (assignment) return;

    const targetSlots = targetTeam === 1 ? team1Slots : team2Slots;
    const emptyIdx = targetSlots.findIndex(s => s === null);
    if (emptyIdx === -1) {
      showFeedback(`${targetTeam}팀 슬롯이 가득 찼습니다.`, 'warning');
      return;
    }

    assignPlayerToSlot(player, targetTeam, emptyIdx);
  };

  // Assign player to slot
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

  // Remove player from slot
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

  // Generate plain copy string
  const getTeamCopyText = () => {
    const t1Names = team1Slots.map(p => (p ? p.name : '(미정)'));
    const t2Names = team2Slots.map(p => (p ? p.name : '(미정)'));
    return `1팀(블루)\n${t1Names.join('\n')}\n2팀(레드)\n${t2Names.join('\n')}`;
  };

  // Generate discord code block format
  const getDiscordFormatText = () => {
    const t1Names = team1Slots.map((p, i) => `${SLOT_CONFIG[i].lane} : ${p ? p.name : '(미정)'}`);
    const t2Names = team2Slots.map((p, i) => `${SLOT_CONFIG[i].lane} : ${p ? p.name : '(미정)'}`);
    return `\`\`\`css\n[1팀 (블루)]\n${t1Names.join('\n')}\n\n[2팀 (레드)]\n${t2Names.join('\n')}\n\`\`\``;
  };

  // Copy plain text
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
      setCopyFeedback('텍스트 복사 완료!');
      showFeedback('팀 명단이 클립보드에 복사되었습니다!', 'success');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (err) {
      showFeedback('복사에 실패했습니다.', 'error');
    }
  };

  // Copy discord format
  const handleCopyDiscordFormat = async () => {
    const text = getDiscordFormatText();
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
      setCopyFeedback('디스코드 포맷 복사 완료!');
      showFeedback('디스코드 포맷이 클립보드에 복사되었습니다!', 'success');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (err) {
      showFeedback('복사에 실패했습니다.', 'error');
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

  const assignedTotal = team1Slots.filter(Boolean).length + team2Slots.filter(Boolean).length;
  const unassignedCount = 10 - assignedTotal;

  // Bottom summary text
  const t1Summary = team1Slots.some(Boolean)
    ? team1Slots.map(p => (p ? p.name : '(미정)')).join(', ')
    : '(미정) × 5';
  const t2Summary = team2Slots.some(Boolean)
    ? team2Slots.map(p => (p ? p.name : '(미정)')).join(', ')
    : '(미정) × 5';

  return (
    <div className="battle-mode-page">
      {/* 1. TOP TITLE & ACTION BAR */}
      <div className="bm-header-bar">
        <div className="bm-title-group">
          <h1 className="bm-main-title">
            <span className="text-team-blue">1팀(블루)</span>
            <span className="text-vs">VS</span>
            <span className="text-team-red">2팀(레드)</span>
            <span className="text-title-label">드래프트</span>
          </h1>
          <span className="bm-mode-badge">e-Sports Battle Mode</span>
        </div>

        <div className="bm-top-btn-group">
          {pickHistory.length > 0 && (
            <button className="bm-btn bm-btn-default" onClick={handleUndoLastPick} title="직전 작업 되돌리기">
              되돌리기
            </button>
          )}
          <button className="bm-btn bm-btn-default" onClick={initDraftPool}>
            로비 불러오기
          </button>
          <button className="bm-btn bm-btn-default" onClick={handleOpenRosterModal}>
            선수 교체
          </button>
          <button className="bm-btn bm-btn-orange" onClick={handleBalanceTeam}>
            ⚡ AI 밸런스 배정
          </button>
          <button className="bm-btn bm-btn-default" onClick={handleRandomShuffle}>
            랜덤 셔플
          </button>
          <button className="bm-btn bm-btn-danger" onClick={handleResetAll}>
            초기화
          </button>
        </div>
      </div>

      {/* 2. DRAFT TURN NOTIFICATION STRIP */}
      <div className="bm-turn-strip">
        <div className="bm-turn-left">
          <span className="bm-turn-badge">
            {currentTarget ? (currentTarget.type === 'CAPTAIN' ? '팀장 선출' : `${currentTarget.slotRole} 선출`) : '배정 완료'}
          </span>
          <span className="bm-turn-desc">
            {currentTarget ? (
              <>
                <strong className={currentTarget.team === 1 ? 'text-team-blue' : 'text-team-red'}>
                  {currentTarget.label}
                </strong>{' '}
                선수를 중앙 10명 명단에서 선택하거나{' '}
                <strong className="text-team-blue">[1팀]</strong>/<strong className="text-team-red">[2팀]</strong> 버튼을 누르세요.
              </>
            ) : (
              '10명 팀 배정이 완료되었습니다! 하단 버튼으로 명단을 복사하세요.'
            )}
          </span>
        </div>
        <span className="bm-turn-status-right">
          {currentTarget ? '실시간 드래프트 대기중' : '드래프트 완료'}
        </span>
      </div>

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div className={`bm-toast-bar ${statusMessage.type}`}>
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 3. MAIN 3-COLUMN LAYOUT: 1팀 (블루) | 중앙 10명 명단 (2열 5행) | 2팀 (레드) */}
      <div className="bm-main-grid">
        {/* LEFT COLUMN: 1팀 (블루) */}
        <div className="bm-team-card bm-team-blue">
          <div className="bm-team-header">
            <div className="bm-team-title-row">
              <span className="bm-team-name text-team-blue">1팀 (블루)</span>
              <span className="bm-count-pill pill-blue">{team1Slots.filter(Boolean).length}/5</span>
            </div>
            <span className="bm-team-avg">평균: {team1TierName}</span>
          </div>

          <div className="bm-slots-list">
            {SLOT_CONFIG.map((cfg) => {
              const player = team1Slots[cfg.slotIndex];
              const isTarget = currentTarget?.team === 1 && currentTarget?.slotIndex === cfg.slotIndex;
              const tierBadgeStyle = player ? getTierBadgeStyle(player.highestTier || player.currentTier) : null;

              return (
                <div
                  key={`t1-${cfg.slotIndex}`}
                  className={`bm-slot-row ${isTarget ? 'is-target' : ''} ${player ? 'is-filled' : 'is-empty'}`}
                  onClick={() => player && handleRemoveFromSlot(1, cfg.slotIndex)}
                  title={player ? '클릭 시 대기실로 복귀' : ''}
                >
                  <div className="bm-lane-sq">{cfg.lane}</div>

                  {player ? (
                    <div className="bm-slot-info">
                      <div className="bm-slot-texts">
                        <span className="bm-slot-role-tag">{cfg.role}</span>
                        <span className="bm-slot-player-name">{player.name}</span>
                      </div>
                      <div className="bm-slot-right">
                        <span
                          className="bm-slot-tier-badge"
                          style={{
                            backgroundColor: tierBadgeStyle.bg,
                            color: tierBadgeStyle.color,
                            borderColor: tierBadgeStyle.border,
                          }}
                        >
                          {player.highestTier || player.currentTier}
                        </span>
                        <button
                          className="bm-slot-remove-btn"
                          onClick={(e) => handleRemoveFromSlot(1, cfg.slotIndex, e)}
                          title="배정 취소"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : isTarget ? (
                    <div className="bm-slot-info target-active">
                      <div className="bm-slot-texts">
                        <span className="bm-slot-highlight-text">{cfg.role} 👉 선택 차례</span>
                        <span className="bm-slot-sub-text">미배정</span>
                      </div>
                      <span className="bm-slot-placeholder-badge">미선택</span>
                    </div>
                  ) : (
                    <div className="bm-slot-info">
                      <div className="bm-slot-texts">
                        <span className="bm-slot-role-tag">{cfg.role}</span>
                        <span className="bm-slot-sub-text">대기 중</span>
                      </div>
                      <span className="bm-slot-empty-dash">-</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bm-team-footer">
            <span className="bm-footer-side">진영: Blue (선픽)</span>
            <span className="bm-footer-state text-team-blue">Ready</span>
          </div>
        </div>

        {/* CENTER COLUMN: 10명 대기 명단 (2열 x 5행) */}
        <div className="bm-center-panel">
          {/* Center Top Toolbar */}
          <div className="bm-center-toolbar">
            <button className="bm-btn-swap" onClick={handleSwapTeams} title="1팀과 2팀 선수 전체 맞바꾸기">
              ⇄ 팀 바꾸기 (1팀 ↔ 2팀 맞교체)
            </button>
            <span className="bm-progress-pill">
              배정 진행 중 ({assignedTotal}/10)
            </span>
            {lobby && (
              <button className="bm-btn-sync" onClick={handleSyncToLobby} title="로비 및 구글 시트에 팀 저장">
                🔄 로비 동기화
              </button>
            )}
          </div>

          {/* Subheader */}
          <div className="bm-center-subheader">
            <span className="bm-center-label">
              <strong>대기 명단 선수</strong> <span className="text-muted">(2줄 5명 고정 / 대기: {unassignedCount}명)</span>
            </span>
            <span className="bm-center-hint">카드를 누르거나 [1팀]/[2팀] 버튼으로 직접 지정</span>
          </div>

          {/* 10-Player Grid (2 columns x 5 rows) */}
          <div className="bm-players-grid">
            {rosterPlayers.map((player) => {
              const tier = player.highestTier || player.currentTier || '언랭';
              const tierStyle = getTierBadgeStyle(tier);
              const assignment = getPlayerAssignment(player);

              const isTop = !!(player.lineTop || player.mainPosition === '탑');
              const isJg = !!(player.lineJungle || player.mainPosition === '정글');
              const isMid = !!(player.lineMid || player.mainPosition === '미드');
              const isAd = !!(player.lineAd || player.mainPosition === '원딜');
              const isSup = !!(player.lineSupport || player.mainPosition === '서폿');

              return (
                <div
                  key={player.id}
                  className={`bm-player-card ${assignment ? (assignment.team === 1 ? 'card-assigned-t1' : 'card-assigned-t2') : 'card-unassigned'}`}
                  onClick={() => handlePlayerCardClick(player)}
                >
                  {/* Row 1: Name + Tier Badge */}
                  <div className="bm-card-row-top">
                    <span className="bm-card-name">{player.name}</span>
                    <span
                      className="bm-card-tier-pill"
                      style={{
                        backgroundColor: tierStyle.bg,
                        color: tierStyle.color,
                        borderColor: tierStyle.border,
                      }}
                    >
                      {tier}
                    </span>
                  </div>

                  {/* Row 2: 5 Lanes (탑, 정글, 미드, 원딜, 서폿) */}
                  <div className="bm-card-row-lanes">
                    <span className={`bm-lane-pill ${isTop ? 'lane-on on-top' : 'lane-off'}`}>탑</span>
                    <span className={`bm-lane-pill ${isJg ? 'lane-on on-jg' : 'lane-off'}`}>정글</span>
                    <span className={`bm-lane-pill ${isMid ? 'lane-on on-mid' : 'lane-off'}`}>미드</span>
                    <span className={`bm-lane-pill ${isAd ? 'lane-on on-ad' : 'lane-off'}`}>원딜</span>
                    <span className={`bm-lane-pill ${isSup ? 'lane-on on-sup' : 'lane-off'}`}>서폿</span>
                  </div>

                  {/* Row 3: 1팀 / 2팀 Buttons or Assigned State */}
                  <div className="bm-card-row-bottom">
                    {!assignment ? (
                      <div className="bm-btn-team-pair">
                        <button
                          className="bm-pick-btn btn-pick-t1"
                          onClick={(e) => handleAssignToTeam(player, 1, e)}
                          disabled={team1Slots.every(Boolean)}
                        >
                          1팀
                        </button>
                        <button
                          className="bm-pick-btn btn-pick-t2"
                          onClick={(e) => handleAssignToTeam(player, 2, e)}
                          disabled={team2Slots.every(Boolean)}
                        >
                          2팀
                        </button>
                      </div>
                    ) : (
                      <div className={`bm-assigned-status ${assignment.team === 1 ? 'status-blue' : 'status-red'}`}>
                        <span className="bm-assigned-label">
                          {assignment.team === 1 ? '1팀(블루)' : '2팀(레드)'} ({assignment.role})
                        </span>
                        <button
                          className="bm-assigned-cancel-x"
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

        {/* RIGHT COLUMN: 2팀 (레드) */}
        <div className="bm-team-card bm-team-red">
          <div className="bm-team-header">
            <div className="bm-team-title-row">
              <span className="bm-team-name text-team-red">2팀 (레드)</span>
              <span className="bm-count-pill pill-red">{team2Slots.filter(Boolean).length}/5</span>
            </div>
            <span className="bm-team-avg">평균: {team2TierName}</span>
          </div>

          <div className="bm-slots-list">
            {SLOT_CONFIG.map((cfg) => {
              const player = team2Slots[cfg.slotIndex];
              const isTarget = currentTarget?.team === 2 && currentTarget?.slotIndex === cfg.slotIndex;
              const tierBadgeStyle = player ? getTierBadgeStyle(player.highestTier || player.currentTier) : null;

              return (
                <div
                  key={`t2-${cfg.slotIndex}`}
                  className={`bm-slot-row ${isTarget ? 'is-target' : ''} ${player ? 'is-filled' : 'is-empty'}`}
                  onClick={() => player && handleRemoveFromSlot(2, cfg.slotIndex)}
                  title={player ? '클릭 시 대기실로 복귀' : ''}
                >
                  <div className="bm-lane-sq">{cfg.lane}</div>

                  {player ? (
                    <div className="bm-slot-info">
                      <div className="bm-slot-texts">
                        <span className="bm-slot-role-tag">{cfg.role}</span>
                        <span className="bm-slot-player-name">{player.name}</span>
                      </div>
                      <div className="bm-slot-right">
                        <span
                          className="bm-slot-tier-badge"
                          style={{
                            backgroundColor: tierBadgeStyle.bg,
                            color: tierBadgeStyle.color,
                            borderColor: tierBadgeStyle.border,
                          }}
                        >
                          {player.highestTier || player.currentTier}
                        </span>
                        <button
                          className="bm-slot-remove-btn"
                          onClick={(e) => handleRemoveFromSlot(2, cfg.slotIndex, e)}
                          title="배정 취소"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : isTarget ? (
                    <div className="bm-slot-info target-active">
                      <div className="bm-slot-texts">
                        <span className="bm-slot-highlight-text">{cfg.role} 👉 선택 차례</span>
                        <span className="bm-slot-sub-text">미배정</span>
                      </div>
                      <span className="bm-slot-placeholder-badge">미선택</span>
                    </div>
                  ) : (
                    <div className="bm-slot-info">
                      <div className="bm-slot-texts">
                        <span className="bm-slot-role-tag">{cfg.role}</span>
                        <span className="bm-slot-sub-text">대기 중</span>
                      </div>
                      <span className="bm-slot-empty-dash">-</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bm-team-footer">
            <span className="bm-footer-side">진영: Red (후픽)</span>
            <span className="bm-footer-state text-team-red">Waiting</span>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM ACTION & COPY BAR */}
      <div className="bm-bottom-bar">
        <div className="bm-bottom-summary">
          <span className="bm-copy-tag">[팀 복사]</span>
          <span className="bm-summary-line">
            1팀(블루): {t1Summary} <span className="text-divider">|</span> 2팀(레드): {t2Summary}
          </span>
        </div>

        <div className="bm-bottom-actions">
          <button className="bm-btn-copy-plain" onClick={handleCopyTeams}>
            {copyFeedback === '텍스트 복사 완료!' ? '✓ 복사 완료!' : '텍스트 복사하기'}
          </button>
          <button className="bm-btn-copy-discord" onClick={handleCopyDiscordFormat}>
            {copyFeedback === '디스코드 포맷 복사 완료!' ? '✓ 복사 완료!' : '디스코드 포맷 생성'}
          </button>
        </div>
      </div>

      {/* ROSTER MODAL (10 Players Selection) */}
      {isRosterModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsRosterModalOpen(false)}>
          <div className="bm-roster-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>선수 10명 선택 ({selectedRosterIds.length}/10)</h3>
              <button className="modal-close-btn" onClick={() => setIsRosterModalOpen(false)}>✕</button>
            </div>

            <div className="modal-search-bar">
              <input
                type="text"
                placeholder="이름, 닉네임, 최고티어 검색..."
                className="bm-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="roster-modal-list">
              {filteredAllPlayers.map(p => {
                const isSelected = selectedRosterIds.includes(p.id);
                const highestTier = p.highestTier || p.currentTier || '언랭';
                const tierStyle = getTierBadgeStyle(highestTier);

                return (
                  <div
                    key={p.id}
                    className={`bm-roster-row ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleTogglePlayerSelection(p.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="roster-checkbox"
                    />
                    <span className="bm-roster-name">{p.name}</span>
                    <span className="bm-roster-pos">{p.mainPosition || '-'}</span>
                    <span className="bm-roster-nick">{p.nickname}</span>
                    <span
                      className="bm-roster-tier-badge"
                      style={{
                        backgroundColor: tierStyle.bg,
                        color: tierStyle.color,
                        borderColor: tierStyle.border,
                      }}
                    >
                      {highestTier}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="modal-footer">
              <span className="modal-info-text">
                {selectedRosterIds.length === 10 ? '✓ 10명이 정확히 선택되었습니다.' : `10명을 맞춰주세요 (현재 ${selectedRosterIds.length}명)`}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="bm-btn bm-btn-default" onClick={() => setIsRosterModalOpen(false)}>
                  취소
                </button>
                <button
                  className="bm-btn bm-btn-orange"
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
