import { Users, UserPlus } from 'lucide-react';
import './MatchModeSelection.css';

const MatchModeSelection = ({ onSelectMode }) => {
    return (
        <div className="mode-selection-container">
            <div className="selection-header">
                <h2 className="selection-title">Who will you face?</h2>
                <p className="selection-subtitle">Select your matchmaking preference</p>
            </div>

            <div className="mode-cards">
                <div className="mode-card" onClick={() => onSelectMode('random')}>
                    <div className="card-icon-container random-icon">
                        <Users size={48} color="white" />
                    </div>
                    <h3 className="card-title">Random Match</h3>
                    <p className="card-description">Find an opponent instantly from players around the world.</p>
                </div>

                <div className="mode-card" onClick={() => onSelectMode('friend')}>
                    <div className="card-icon-container friend-icon">
                        <UserPlus size={48} color="white" />
                    </div>
                    <h3 className="card-title">Play with Friend</h3>
                    <p className="card-description">Invite a specific player by entering their unique username.</p>
                </div>
            </div>
        </div>
    );
};

export default MatchModeSelection;
