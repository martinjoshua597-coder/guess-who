import { useState, useEffect } from 'react';
import { Ghost, Bell, LogOut } from 'lucide-react';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import VideoSection from './components/VideoSection';
import GameSection from './components/GameSection';
import Login from './components/Login';
import ChooseUsername from './components/ChooseUsername';
import GameSelection from './components/GameSelection';
import Matchmaking from './components/Matchmaking';
import MatchModeSelection from './components/MatchModeSelection';
import FriendMatch from './components/FriendMatch';

function AppInner() {
  const { user, displayName, loading, signOut } = useAuth();

  const [appState, setAppState] = useState('game-selection');
  const [activeGame, setActiveGame] = useState('mystery-face');
  const [currentUser, setCurrentUser] = useState('');
  const [friendUsername, setFriendUsername] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [isRandomMatch, setIsRandomMatch] = useState(false);

  useEffect(() => {
    if (user && !currentUser) {
      setCurrentUser(displayName || user.email?.split('@')[0] || 'Player');
    }
  }, [user, displayName]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--accent-purple)', fontSize: '1.2rem' }}>Loading...</div>
      </div>
    );
  }

  if (!user) return <Login />;


  const handleSelectGame = (gameItem) => {
    setActiveGame(gameItem);
    setAppState('match-mode-selection');
  };

  const handleSelectMatchMode = (mode) => {
    if (mode === 'random') {
      setFriendUsername('');
      setAppState('matchmaking');
    } else {
      setAppState('friend-match');
    }
  };

  const handleFriendConnect = (username) => {
    setFriendUsername(username);
    setIsRandomMatch(false);
    const id = [currentUser, username].sort().join('-');
    setRoomId(id);
    setAppState('gameplay');
  };

  const handleMatchFound = (matchedRoomId) => {
    setFriendUsername('Opponent');
    setIsRandomMatch(true);
    setRoomId(matchedRoomId);
    setAppState('gameplay');
  };

  if (appState === 'choose-username') {
    return <ChooseUsername onUsernameChosen={(u) => { setCurrentUser(u); setAppState('game-selection'); }} />;
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="brand" onClick={() => setAppState('game-selection')} style={{ cursor: 'pointer' }}>
          <Ghost className="brand-icon" size={28} />
          <span className="brand-font">MYSTERY DUEL</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn"><Bell size={20} color="var(--text-secondary)" /></button>
          <div className="user-profile">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="avatar" className="avatar"
                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
            ) : <div className="avatar" />}
            <span>{currentUser || 'Player'}</span>
          </div>
          <button className="icon-btn" onClick={signOut} title="Sign out">
            <LogOut size={18} color="var(--text-secondary)" />
          </button>
        </div>
      </header>

      <main className="main-content">
        {appState === 'game-selection' && <GameSelection onSelectGame={handleSelectGame} />}
        {appState === 'match-mode-selection' && <MatchModeSelection onSelectMode={handleSelectMatchMode} />}
        {appState === 'friend-match' && <FriendMatch onConnect={handleFriendConnect} currentUser={currentUser} />}
        {appState === 'matchmaking' && <Matchmaking onMatchFound={handleMatchFound} currentUserId={user.id} />}

        {appState === 'gameplay' && (
          <GameProvider roomId={roomId} currentUserId={user.id}>
            <VideoSection
              currentUserName={currentUser}
              opponentName={friendUsername}
              roomId={roomId}
            />
            <GameSection
              activeGame={activeGame}
              setActiveGame={setActiveGame}
              onNewMatch={isRandomMatch ? () => { setIsRandomMatch(false); setRoomId(null); setAppState('matchmaking'); } : null}
            />
          </GameProvider>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
