import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initBot } from './bot.js';
import { updateTeamsToSheet } from './googleSheets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to find files in current or parent directory
function getPath(filename) {
  let fullPath = path.resolve(__dirname, filename);
  if (fs.existsSync(fullPath)) return fullPath;
  fullPath = path.resolve(__dirname, '..', filename);
  if (fs.existsSync(fullPath)) return fullPath;
  return path.resolve(process.cwd(), filename);
}

dotenv.config({ path: getPath('.env') });

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for local networking ease
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Serve static React app in production mode
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// Helper to calculate tier rank score (lower is higher tier: 1=Challenger, 2=Grandmaster, 3=Master...)
function getTierSortScore(tierStr) {
  if (!tierStr || tierStr === '언랭') return 99;
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
}

// In-memory Mock Data for standalone testing without database (Sorted by highestTier)
const MOCK_PLAYERS = [
  { id: 'p1', name: '김민수', nickname: 'Hide on bush#KR1', currentTier: '챌린저', highestTier: '챌린저', maxTierSort: 1, mainPosition: '미드', lineMid: true, lineTop: true, wins: 15, losses: 5, age: '24', totalVoiceTime: 3600 },
  { id: 'p8', name: '송민호', nickname: 'Zeka#KR1', currentTier: '챌린저', highestTier: '챌린저', maxTierSort: 1, mainPosition: '미드', lineMid: true, wins: 14, losses: 4, age: '23', totalVoiceTime: 4500 },
  { id: 'p5', name: '정유진', nickname: 'Keria#KR1', currentTier: '그랜드마스터', highestTier: '챌린저', maxTierSort: 1, mainPosition: '서폿', lineSupport: true, lineMid: true, wins: 14, losses: 5, age: '22', totalVoiceTime: 4800 },
  { id: 'p7', name: '윤서진', nickname: 'Peanut#KR1', currentTier: '그랜드마스터', highestTier: '챌린저', maxTierSort: 1, mainPosition: '정글', lineJungle: true, wins: 13, losses: 7, age: '26', totalVoiceTime: 3800 },
  { id: 'p9', name: '한상우', nickname: 'Viper#KR1', currentTier: '마스터', highestTier: '챌린저', maxTierSort: 1, mainPosition: '원딜', lineAd: true, wins: 11, losses: 7, age: '24', totalVoiceTime: 3400 },
  { id: 'p2', name: '이도현', nickname: 'Zeus#KR1', currentTier: '그랜드마스터', highestTier: '그랜드마스터', maxTierSort: 2, mainPosition: '탑', lineTop: true, wins: 12, losses: 6, age: '22', totalVoiceTime: 4200 },
  { id: 'p4', name: '최준혁', nickname: 'Gumayusi#KR1', currentTier: '마스터', highestTier: '그랜드마스터', maxTierSort: 2, mainPosition: '원딜', lineAd: true, wins: 11, losses: 6, age: '24', totalVoiceTime: 5000 },
  { id: 'p6', name: '강동원', nickname: 'Doran#KR1', currentTier: '마스터', highestTier: '그랜드마스터', maxTierSort: 2, mainPosition: '탑', lineTop: true, wins: 9, losses: 8, age: '25', totalVoiceTime: 2900 },
  { id: 'p3', name: '박지원', nickname: 'Oner#KR1', currentTier: '마스터', highestTier: '마스터', maxTierSort: 3, mainPosition: '정글', lineJungle: true, wins: 10, losses: 7, age: '23', totalVoiceTime: 3100 },
  { id: 'p10', name: '임태훈', nickname: 'Delight#KR1', currentTier: '다이아1', highestTier: '마스터', maxTierSort: 3, mainPosition: '서폿', lineSupport: true, wins: 8, losses: 9, age: '23', totalVoiceTime: 2700 },
];

let inMemoryPlayers = [...MOCK_PLAYERS];
let inMemoryLobby = {
  id: 'test-lobby-1',
  channelId: 'test-channel',
  creatorId: 'admin',
  creatorName: '내전관리자',
  status: 'OPEN',
  participants: JSON.stringify(MOCK_PLAYERS.map(p => p.id)),
  blueTeam: null,
  redTeam: null,
  timestamp: new Date(),
};
let inMemoryMatches = [];

// API: Get Leaderboard standings - Sorted strictly by highestTier / maxTierSort
app.get('/api/players', async (req, res) => {
  try {
    const players = await prisma.player.findMany({
      orderBy: [
        { maxTierSort: 'asc' },
        { wins: 'desc' }
      ]
    });
    if (players && players.length > 0) {
      // Ensure strict sorting by highestTier
      players.sort((a, b) => {
        const diff = getTierSortScore(a.highestTier || a.currentTier) - getTierSortScore(b.highestTier || b.currentTier);
        if (diff !== 0) return diff;
        return (b.wins || 0) - (a.wins || 0);
      });
      return res.json(players);
    }
    // Fallback if DB is empty
    res.json(inMemoryPlayers);
  } catch (error) {
    console.warn('⚠️ [Prisma] DB lookup failed, returning in-memory players:', error.message);
    res.json(inMemoryPlayers);
  }
});

// API: Get Active Lobby
app.get('/api/lobby', async (req, res) => {
  try {
    const activeLobby = await prisma.lobby.findFirst({
      where: { status: 'OPEN' },
      orderBy: { timestamp: 'desc' }
    });
    
    if (activeLobby) {
      const participantIds = JSON.parse(activeLobby.participants || '[]');
      const players = await prisma.player.findMany({
        where: { id: { in: participantIds } }
      });
      return res.json({
        ...activeLobby,
        participants: players
      });
    }

    // Fallback in-memory lobby
    res.json({
      ...inMemoryLobby,
      participants: inMemoryPlayers.slice(0, 10),
    });
  } catch (error) {
    console.warn('⚠️ [Prisma] DB lookup failed, returning in-memory lobby:', error.message);
    res.json({
      ...inMemoryLobby,
      participants: inMemoryPlayers.slice(0, 10),
    });
  }
});

// API: Get Voice Activity by Date Range
app.get('/api/voice/usage', async (req, res) => {
  const { start, end } = req.query; // YYYY-MM-DD format

  try {
    let whereClause = {};
    if (start && end && start !== 'all' && end !== 'all') {
      const startDate = new Date(start);
      const endDate = new Date(end);
      // Include the entire end date (up to 23:59:59.999)
      endDate.setHours(23, 59, 59, 999);
      whereClause = {
        joinTime: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    const logs = await prisma.voiceLog.findMany({
      where: whereClause,
    });

    // Aggregate by userId
    const usageMap = {};
    for (const log of logs) {
      if (!usageMap[log.userId]) {
        usageMap[log.userId] = {
          userId: log.userId,
          userName: log.userName,
          totalDuration: 0,
          sessionsCount: 0,
        };
      }
      usageMap[log.userId].totalDuration += log.duration;
      usageMap[log.userId].sessionsCount += 1;
    }

    // Sort by duration descending
    const result = Object.values(usageMap).sort((a, b) => b.totalDuration - a.totalDuration);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get Pending and Recent Matches
app.get('/api/matches', async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { date: 'desc' },
      take: 20
    });
    res.json(matches.length > 0 ? matches : inMemoryMatches);
  } catch (error) {
    console.warn('⚠️ [Prisma] DB lookup failed, returning in-memory matches:', error.message);
    res.json(inMemoryMatches);
  }
});

// API: Create Draft Match & assign teams to active lobby
app.post('/api/match/create', async (req, res) => {
  const { blueTeam, redTeam, lobbyId } = req.body;

  if (!blueTeam || !redTeam || !Array.isArray(blueTeam) || !Array.isArray(redTeam)) {
    return res.status(400).json({ error: '블루팀과 레드팀 명단(배열)이 필요합니다.' });
  }

  try {
    // 1. Create match record in DB
    const match = await prisma.match.create({
      data: {
        blueTeam: JSON.stringify(blueTeam),
        redTeam: JSON.stringify(redTeam),
        winner: 'PENDING',
      }
    });

    // 2. Link to target or active lobby if exists
    let updatedLobby = null;
    let targetLobby = null;
    if (lobbyId) {
      targetLobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    }
    if (!targetLobby) {
      targetLobby = await prisma.lobby.findFirst({
        where: { status: 'OPEN' },
        orderBy: { timestamp: 'desc' }
      });
    }

    if (targetLobby) {
      updatedLobby = await prisma.lobby.update({
        where: { id: targetLobby.id },
        data: {
          blueTeam: JSON.stringify(blueTeam),
          redTeam: JSON.stringify(redTeam),
        }
      });

      // Resolve player profiles for participants
      const participantIds = JSON.parse(updatedLobby.participants || '[]');
      const players = await prisma.player.findMany({
        where: { id: { in: participantIds } }
      });
      const orderedPlayers = participantIds.map(id => players.find(p => p.id === id)).filter(Boolean);

      io.emit('lobbyUpdate', {
        ...updatedLobby,
        blueTeam: blueTeam,
        redTeam: redTeam,
        participants: orderedPlayers,
      });
    }

    // 3. Emit new match event to all connected websockets
    io.emit('newMatch', match);

    // 4. Update Google Sheet asynchronously if configured
    updateTeamsToSheet(blueTeam, redTeam).catch(err => {
      console.warn('⚠️ Google Sheets team sync error:', err.message);
    });

    console.log(`⚔️ New match created via Web Draft! Match #${match.id} (Blue: ${blueTeam.length}, Red: ${redTeam.length})`);
    res.json({ success: true, match, lobby: updatedLobby });
  } catch (error) {
    console.warn('⚠️ [Prisma] DB match creation failed, using in-memory store:', error.message);
    
    // In-memory fallback match creation
    const fallbackMatch = {
      id: inMemoryMatches.length + 1,
      date: new Date(),
      blueTeam: JSON.stringify(blueTeam),
      redTeam: JSON.stringify(redTeam),
      winner: 'PENDING',
    };
    inMemoryMatches.unshift(fallbackMatch);

    inMemoryLobby = {
      ...inMemoryLobby,
      blueTeam: JSON.stringify(blueTeam),
      redTeam: JSON.stringify(redTeam),
    };

    io.emit('newMatch', fallbackMatch);
    io.emit('lobbyUpdate', {
      ...inMemoryLobby,
      blueTeam,
      redTeam,
      participants: inMemoryPlayers.slice(0, 10),
    });

    res.json({ success: true, match: fallbackMatch, lobby: inMemoryLobby });
  }
});

// API: Save or update team assignment in active lobby without creating a match yet
app.post('/api/lobby/teams', async (req, res) => {
  const { blueTeam, redTeam, lobbyId } = req.body;

  try {
    let targetLobby = null;
    if (lobbyId) {
      targetLobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    }
    if (!targetLobby) {
      targetLobby = await prisma.lobby.findFirst({
        where: { status: 'OPEN' },
        orderBy: { timestamp: 'desc' }
      });
    }

    if (!targetLobby) {
      return res.status(404).json({ error: '활성화된 대기열 로비가 없습니다.' });
    }

    const updatedLobby = await prisma.lobby.update({
      where: { id: targetLobby.id },
      data: {
        blueTeam: blueTeam ? JSON.stringify(blueTeam) : null,
        redTeam: redTeam ? JSON.stringify(redTeam) : null,
      }
    });

    const participantIds = JSON.parse(updatedLobby.participants || '[]');
    const players = await prisma.player.findMany({
      where: { id: { in: participantIds } }
    });
    const orderedPlayers = participantIds.map(id => players.find(p => p.id === id)).filter(Boolean);

    io.emit('lobbyUpdate', {
      ...updatedLobby,
      blueTeam: blueTeam || null,
      redTeam: redTeam || null,
      participants: orderedPlayers,
    });

    res.json({ success: true, lobby: updatedLobby });
  } catch (error) {
    console.warn('⚠️ [Prisma] DB update lobby teams failed, using in-memory store:', error.message);
    inMemoryLobby = {
      ...inMemoryLobby,
      blueTeam: blueTeam ? JSON.stringify(blueTeam) : null,
      redTeam: redTeam ? JSON.stringify(redTeam) : null,
    };
    io.emit('lobbyUpdate', {
      ...inMemoryLobby,
      blueTeam: blueTeam || null,
      redTeam: redTeam || null,
      participants: inMemoryPlayers.slice(0, 10),
    });
    res.json({ success: true, lobby: inMemoryLobby });
  }
});

// API: Resolve Match (Update MMR & Win/Loss)
app.post('/api/match/resolve', async (req, res) => {
  const { matchId, winner } = req.body; // winner: "BLUE" or "RED"
  const authHeader = req.headers.authorization;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Admin Password' });
  }

  if (winner !== 'BLUE' && winner !== 'RED') {
    return res.status(400).json({ error: 'Invalid winner. Must be BLUE or RED' });
  }

  try {
    const match = await prisma.match.findUnique({
      where: { id: parseInt(matchId) }
    });

    if (!match) {
      // Check in-memory matches
      const memMatch = inMemoryMatches.find(m => m.id === parseInt(matchId));
      if (!memMatch) {
        return res.status(404).json({ error: 'Match not found' });
      }
      memMatch.winner = winner;
      
      const blueTeam = JSON.parse(memMatch.blueTeam || '[]');
      const redTeam = JSON.parse(memMatch.redTeam || '[]');
      const mmrChange = 15;

      inMemoryPlayers = inMemoryPlayers.map(p => {
        if (blueTeam.includes(p.name)) {
          const win = winner === 'BLUE';
          return {
            ...p,
            wins: p.wins + (win ? 1 : 0),
            losses: p.losses + (win ? 0 : 1),
            mmr: p.mmr + (win ? mmrChange : -mmrChange),
          };
        }
        if (redTeam.includes(p.name)) {
          const win = winner === 'RED';
          return {
            ...p,
            wins: p.wins + (win ? 1 : 0),
            losses: p.losses + (win ? 0 : 1),
            mmr: p.mmr + (win ? mmrChange : -mmrChange),
          };
        }
        return p;
      });

      io.emit('leaderboardUpdate', inMemoryPlayers);
      io.emit('matchResolved', { matchId: parseInt(matchId), winner });
      return res.json({ success: true });
    }

    if (match.winner !== 'PENDING') {
      return res.status(400).json({ error: 'Match already resolved' });
    }

    const blueTeam = JSON.parse(match.blueTeam);
    const redTeam = JSON.parse(match.redTeam);

    const mmrChange = 15;

    // Transaction to update players and match state
    await prisma.$transaction(async (tx) => {
      // 1. Update Blue team
      for (const name of blueTeam) {
        const win = winner === 'BLUE';
        await tx.player.update({
          where: { name },
          data: {
            wins: { increment: win ? 1 : 0 },
            losses: { increment: win ? 0 : 1 },
            mmr: { increment: win ? mmrChange : -mmrChange }
          }
        });
      }

      // 2. Update Red team
      for (const name of redTeam) {
        const win = winner === 'RED';
        await tx.player.update({
          where: { name },
          data: {
            wins: { increment: win ? 1 : 0 },
            losses: { increment: win ? 0 : 1 },
            mmr: { increment: win ? mmrChange : -mmrChange }
          }
        });
      }

      // 3. Mark match resolved
      await tx.match.update({
        where: { id: parseInt(matchId) },
        data: { winner }
      });
    });

    console.log(`🏆 Match #${matchId} resolved successfully. Winner: ${winner}`);

    // Broadcast update to all connected WebSockets
    const updatedLeaderboard = await prisma.player.findMany({
      orderBy: [
        { mmr: 'desc' },
        { wins: 'desc' }
      ]
    });
    io.emit('leaderboardUpdate', updatedLeaderboard);
    io.emit('matchResolved', { matchId, winner });

    res.json({ success: true });
  } catch (error) {
    console.error('Error resolving match:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend route fallback (SPA routing)
if (fs.existsSync(publicPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Websockets
io.on('connection', (socket) => {
  console.log('📡 Web client connected to WebSockets:', socket.id);
  socket.on('disconnect', () => {
    console.log('📡 Web client disconnected:', socket.id);
  });
});

// Start Server & Bot
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Express server running on port ${PORT}`);
  
  // Initialize Discord Bot inside the server process
  initBot(io).catch(err => {
    console.error('❌ Failed to initialize Discord Bot:', err.message);
  });
});
