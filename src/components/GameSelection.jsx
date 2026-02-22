import { Ghost, ArrowUpSquare } from 'lucide-react';
import './GameSelection.css';

const GameSelection = ({ onSelectGame }) => {
    return (
        <div className="game-selection-container">
            <div className="selection-header">
                <h2 className="selection-title">Select Mode</h2>
                <p className="selection-subtitle">Choose your challenge</p>
            </div>

            <div className="game-cards">
                <div className="game-card" onClick={() => onSelectGame('mystery-face')}>
                    <div className="card-icon-container mystery-icon">
                        <Ghost size={48} color="white" />
                    </div>
                    <h3 className="card-title">Mystery Face</h3>
                    <p className="card-description">Ask clever yes/no questions to deduce your opponent's secret face before they guess yours.</p>
                    <div className="card-badge">Classic Mode</div>
                </div>

                <div className="game-card" onClick={() => onSelectGame('higher-lower')}>
                    <div className="card-icon-container higher-icon">
                        <ArrowUpSquare size={48} color="white" />
                    </div>
                    <h3 className="card-title">Higher / Lower</h3>
                    <p className="card-description">A fast-paced numbers game. Guess if the next number will be higher or lower.</p>
                    <div className="card-badge">Quick Play</div>
                </div>
            </div>
        </div>
    );
};

export default GameSelection;
