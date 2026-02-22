import { useState } from 'react';
import { UserPlus, ArrowRight, Loader2 } from 'lucide-react';
import './FriendMatch.css';

const FriendMatch = ({ onConnect, currentUser }) => {
    const [username, setUsername] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);

        const trimmed = username.trim();
        if (!trimmed) return;

        if (currentUser && trimmed.toLowerCase() === currentUser.toLowerCase()) {
            setError("You cannot play against yourself. Please enter a different username.");
            return;
        }

        setIsConnecting(true);

        // Simulate connection delay
        setTimeout(() => {
            onConnect(trimmed);
        }, 1500);
    };

    return (
        <div className="friend-match-container">
            <div className="friend-match-content">
                <div className="icon-wrapper">
                    <UserPlus size={40} className="header-icon" />
                </div>
                <h2 className="match-title">Play with Friend</h2>
                <p className="match-subtitle">Enter your friend's exact username to send them a duel request.</p>

                <form onSubmit={handleSubmit} className="friend-form">
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Friend's Username"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                if (error) setError(null);
                            }}
                            className={`friend-input ${error ? 'input-error' : ''}`}
                            disabled={isConnecting}
                            autoFocus
                        />
                        {error && <p className="error-text" style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '8px' }}>{error}</p>}
                    </div>

                    <button
                        type="submit"
                        className="connect-btn"
                        disabled={!username.trim() || isConnecting}
                    >
                        {isConnecting ? (
                            <>
                                <Loader2 size={20} className="spinner" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                Send Invite
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                {isConnecting && (
                    <div className="connecting-status">
                        <div className="pulse-ring"></div>
                        <span>Waiting for {username} to accept...</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FriendMatch;
