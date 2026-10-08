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

// API: Get Leaderboard standings
app.get('/api/players', async (req, res) => {
  try {
    const players = await prisma.player.findMany({
      orderBy: [
        { mmr: 'desc' },
        { wins: 'desc' }
      ]
    });
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get Active Lobby
app.get('/api/lobby', async (req, res) => {
  try {
    const activeLobby = await prisma.lobby.findFirst({
      where: { status: 'OPEN' },
      orderBy: { timestamp: 'desc' }
    });
    
    if (!activeLobby) {
      return res.json(null);
    }
    
    // Parse JSON lists
    const participantIds = JSON.parse(activeLobby.participants || '[]');
    
    // Resolve player profiles for these participants
    const players = await prisma.player.findMany({
      where: {
        id: { in: participantIds }
      }
    });

    res.json({
      ...activeLobby,
      participants: players
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      return res.status(404).json({ error: 'Match not found' });
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
