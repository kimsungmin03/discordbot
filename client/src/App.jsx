import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './pages/Lobby';
import TeamDraft from './pages/TeamDraft';
import Leaderboard from './pages/Leaderboard';
import Matchup from './pages/Matchup';
import VoiceUsage from './pages/VoiceUsage';

// Socket connection
const socket = io();

function App() {
  const [activeTab, setActiveTab] = useState('lobby');
  const [lobby, setLobby] = useState(null);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetch('/api/lobby')
      .then(res => res.json())
      .then(data => setLobby(data))
      .catch(err => console.error('Error fetching lobby:', err));

    fetch('/api/players')
      .then(res => res.json())
      .then(data => setPlayers(data))
      .catch(err => console.error('Error fetching leaderboard:', err));

    fetch('/api/matches')
      .then(res => res.json())
      .then(data => setMatches(data))
      .catch(err => console.error('Error fetching matches:', err));
  }, []);

  // WebSockets event listeners
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server via WebSockets');
    });

    socket.on('lobbyUpdate', (updatedLobby) => {
      console.log('Lobby Update received:', updatedLobby);
      setLobby(updatedLobby);
    });

    socket.on('leaderboardUpdate', (updatedPlayers) => {
      console.log('Leaderboard Update received:', updatedPlayers);
      setPlayers(updatedPlayers);
    });

    socket.on('newMatch', (newMatch) => {
      console.log('New Match created:', newMatch);
      setMatches(prev => [newMatch, ...prev]);
    });

    socket.on('matchResolved', ({ matchId, winner }) => {
      console.log(`Match #${matchId} resolved. Winner: ${winner}`);
      setMatches(prev => 
        prev.map(m => m.id === parseInt(matchId) ? { ...m, winner } : m)
      );
    });

    return () => {
      socket.off('connect');
      socket.off('lobbyUpdate');
      socket.off('leaderboardUpdate');
      socket.off('newMatch');
      socket.off('matchResolved');
    };
  }, []);

  return (
    <div className={`app-container ${isSidebarOpen ? 'sidebar-active' : ''}`}>
      {/* Desktop Header */}
      <header className="navbar desktop-only">
        <div className="nav-brand">
          <h1>🎮 LOBBY & LEADERBOARD</h1>
        </div>
        <nav className="nav-links">
          <button 
            className={`nav-link ${activeTab === 'lobby' ? 'active' : ''}`}
            onClick={() => setActiveTab('lobby')}
          >
            대기열 현황
          </button>
          <button 
            className={`nav-link ${activeTab === 'draft' ? 'active' : ''}`}
            onClick={() => setActiveTab('draft')}
            style={{ color: activeTab === 'draft' ? 'var(--gold-primary)' : undefined, fontWeight: '700' }}
          >
            🎮 팀 드래프트
          </button>
          <button 
            className={`nav-link ${activeTab === 'matchup' ? 'active' : ''}`}
            onClick={() => setActiveTab('matchup')}
          >
            대진 결과 보고
          </button>
          <button 
            className={`nav-link ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            소환사 랭킹판
          </button>
          <button 
            className={`nav-link ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            음성 활동량
          </button>
        </nav>
      </header>

      {/* Mobile Top Header with Hamburger Icon */}
      <header className="mobile-header mobile-only">
        <button className="burger-menu-btn" onClick={() => setIsSidebarOpen(true)}>
          ☰
        </button>
        <div className="mobile-nav-brand">
          <h1>🎮 LOBBY & STATS</h1>
        </div>
        <div style={{ width: '40px' }}></div> {/* Balanced spacer */}
      </header>

      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div className="mobile-sidebar-backdrop mobile-only" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside className={`mobile-sidebar mobile-only ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">메뉴 목록</span>
          <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>
            ✕
          </button>
        </div>
        
        <nav className="sidebar-links">
          <button 
            className={`sidebar-link ${activeTab === 'lobby' ? 'active' : ''}`}
            onClick={() => { setActiveTab('lobby'); setIsSidebarOpen(false); }}
          >
            <span className="sidebar-icon">👥</span> 대기열 현황
          </button>
          <button 
            className={`sidebar-link ${activeTab === 'draft' ? 'active' : ''}`}
            onClick={() => { setActiveTab('draft'); setIsSidebarOpen(false); }}
          >
            <span className="sidebar-icon">🎮</span> 팀 드래프트
          </button>
          <button 
            className={`sidebar-link ${activeTab === 'matchup' ? 'active' : ''}`}
            onClick={() => { setActiveTab('matchup'); setIsSidebarOpen(false); }}
          >
            <span className="sidebar-icon">⚔️</span> 대진 결과 보고
          </button>
          <button 
            className={`sidebar-link ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('leaderboard'); setIsSidebarOpen(false); }}
          >
            <span className="sidebar-icon">🏆</span> 소환사 랭킹판
          </button>
          <button 
            className={`sidebar-link ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => { setActiveTab('voice'); setIsSidebarOpen(false); }}
          >
            <span className="sidebar-icon">🎙️</span> 음성 활동량
          </button>
        </nav>

        <div className="sidebar-footer">
          <p>© 2026 DIRCORD NEJEON</p>
        </div>
      </aside>

      {/* Main Page Area */}
      <main className="main-content">
        {activeTab === 'lobby' && (
          <Lobby lobby={lobby} onNavigateTab={setActiveTab} />
        )}
        {activeTab === 'draft' && (
          <TeamDraft lobby={lobby} allPlayers={players} onNavigateTab={setActiveTab} />
        )}
        {activeTab === 'matchup' && (
          <Matchup matches={matches} />
        )}
        {activeTab === 'leaderboard' && (
          <Leaderboard players={players} />
        )}
        {activeTab === 'voice' && (
          <VoiceUsage />
        )}
      </main>
    </div>
  );
}

export default App;

