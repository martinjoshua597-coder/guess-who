import React from 'react';
import './GameSection.css';
import MysteryFaceBoard from './MysteryFaceBoard';
import HigherLowerGame from './HigherLowerGame';
import { RefreshCw } from 'lucide-react';

const GameSection = ({ activeGame, setActiveGame, onNewMatch }) => {
    return (
        <div className="game-section">
            <div className="game-header">
                <div className="game-tabs">
                    <button
                        className={`tab-btn ${activeGame === 'mystery-face' ? 'active' : ''}`}
                        onClick={() => setActiveGame('mystery-face')}
                    >
                        Mystery Face
                    </button>
                    <button
                        className={`tab-btn ${activeGame === 'higher-lower' ? 'active' : ''}`}
                        onClick={() => setActiveGame('higher-lower')}
                    >
                        Higher/Lower
                    </button>
                </div>

                <div className="game-controls">
                    <span className="turn-indicator">Turn: <span className="highlight-green">UserA</span></span>
                    {onNewMatch && (
                        <button className="new-match-btn" onClick={onNewMatch} title="Find a new random opponent">
                            <RefreshCw size={14} />
                            New Match
                        </button>
                    )}
                    <button className="live-btn">Live Now</button>
                </div>
            </div>

            <div className="game-content">
                {activeGame === 'mystery-face' ? <MysteryFaceBoard /> : <HigherLowerGame />}
            </div>
        </div>
    );
};

export default GameSection;
