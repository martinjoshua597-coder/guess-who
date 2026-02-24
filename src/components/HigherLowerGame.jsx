import React, { useState, useEffect } from 'react';
import './HigherLowerGame.css';
import { ArrowUpCircle, ArrowDownCircle, Lock, Eye, RotateCcw, CheckCircle, Delete, Loader2 } from 'lucide-react';
import { useGame } from '../context/GameContext';

const HigherLowerGame = () => {
    const min = 0;
    const max = 100;
    const game = useGame(); // Connect to multiplayer state

    // Local states
    const [inputSecret, setInputSecret] = useState('');
    const [keypadInput, setKeypadInput] = useState('');

    // Pull from context if playing multiplayer, fallback to local state for solo dev
    const [localSecret, setLocalSecret] = useState(null);
    const [localOpponentSecret, setLocalOpponentSecret] = useState(null);
    const [localGuessHistory, setLocalGuessHistory] = useState([]);
    const [localIsRevealed, setLocalIsRevealed] = useState(false);

    const hlSecret = game?.hlSecret !== undefined ? game.hlSecret : localSecret;
    const opponentHlSecret = game?.opponentHlSecret !== undefined ? game.opponentHlSecret : localOpponentSecret;
    const guessHistory = game?.guessHistory || localGuessHistory;
    const isRevealed = game ? game.revealedFaceId === 'higher_lower' : localIsRevealed;

    const setHlSecretFn = game?.setHlSecret || setLocalSecret;
    const setGuessHistoryFn = (updater) => {
        const newHistory = typeof updater === 'function' ? updater(guessHistory) : updater;
        if (game) {
            game.setGuessHistory(newHistory);
            game.broadcastGuessUpdate(newHistory);
        } else {
            setLocalGuessHistory(newHistory);
        }
    };

    // Determine phase
    const isChoosingSecret = hlSecret === null;
    const isWaitingForOpponent = hlSecret !== null && opponentHlSecret === null && game?.opponentReady;

    const handleLockSecret = (e) => {
        e.preventDefault();
        const num = parseInt(inputSecret, 10);
        if (!isNaN(num) && num >= min && num <= max) {
            setHlSecretFn(num);
            game?.broadcastHlSecret(num); // Tell opponent our secret

            // If playing solo (no game context or opponent not ready), act as both
            if (!game?.opponentReady) {
                if (game) {
                    game.setOpponentHlSecret(num); // Mock opponent for solo dev
                } else {
                    setLocalOpponentSecret(num);
                }
            }
        }
    };

    const handleReveal = () => {
        if (game) {
            game.setRevealedFaceId('higher_lower');
            game.broadcastReveal('higher_lower');
        } else {
            setLocalIsRevealed(true);
        }
    };

    // Sync incoming reveal from opponent
    useEffect(() => {
        if (game?.revealedFaceId === 'higher_lower' && !isRevealed) {
            // Handled generically by checking game.revealedFaceId above
        }
    }, [game?.revealedFaceId]);


    const handleReset = () => {
        // Only reset local states. A full game reset might need coordination,
        // but for now we'll allow players to reset their own view.
        if (game) {
            game.setHlSecret(null);
            game.setOpponentHlSecret(null);
            game.setGuessHistory([]);
            game.setRevealedFaceId(null);
        } else {
            setLocalSecret(null);
            setLocalOpponentSecret(null);
            setLocalGuessHistory([]);
            setLocalIsRevealed(false);
        }
        setInputSecret('');
        setKeypadInput('');
    };

    const handleKeypadPress = (val) => {
        if (isRevealed) return;
        if (val === 'DEL') {
            setKeypadInput(prev => prev.slice(0, -1));
        } else if (val === 'GUESS') {
            if (keypadInput === '') return;
            const num = parseInt(keypadInput, 10);

            let result = '';
            let triggerReveal = false;

            // Notice we guess against opponentHlSecret, NOT hlSecret
            const targetNumber = opponentHlSecret;

            if (num < targetNumber) {
                result = 'HIGHER';
            } else if (num > targetNumber) {
                result = 'LOWER';
            } else {
                result = 'CORRECT';
                triggerReveal = true;
            }

            setGuessHistoryFn(prev => [...prev, { guess: num, result }]);
            setKeypadInput('');

            if (triggerReveal) {
                setTimeout(() => handleReveal(), 500); // Slight delay for satisfaction
            }
        } else {
            // Number press
            setKeypadInput(prev => {
                const newVal = prev + val;
                // Prevent extremely long numbers, cap around max digits needed
                if (parseInt(newVal, 10) > 999) return prev;
                return newVal;
            });
        }
    };

    return (
        <div className="higher-lower-container">
            {isChoosingSecret ? (
                <div className="choose-secret-step">
                    <h2 className="hl-title">Set Your Secret Number</h2>
                    <p className="hl-subtitle">Pick a number between {min} and {max} for your opponent to guess.</p>

                    <form onSubmit={handleLockSecret} className="secret-form">
                        <input
                            type="number"
                            min={min}
                            max={max}
                            value={inputSecret}
                            onChange={(e) => setInputSecret(e.target.value)}
                            placeholder="e.g. 42"
                            className="secret-input"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="lock-secret-btn"
                            disabled={!inputSecret || parseInt(inputSecret, 10) < min || parseInt(inputSecret, 10) > max}
                        >
                            <Lock size={18} />
                            Lock Number
                        </button>
                    </form>
                </div>
            ) : isWaitingForOpponent ? (
                <div className="choose-secret-step waiting-step">
                    <div className="pulse-ring"></div>
                    <h2 className="hl-title">Waiting for Opponent</h2>
                    <p className="hl-subtitle">You locked in <strong>{hlSecret}</strong>. Waiting for them to choose...</p>
                </div>
            ) : (
                <div className="game-step">
                    {/* Left Sidebar: Guess History */}
                    <div className="guess-sidebar">
                        <div className="guess-sidebar-header">
                            <h3>Guesses: <span className="highlight-count">{guessHistory.length}</span></h3>
                        </div>
                        <div className="guess-list">
                            {guessHistory.length === 0 ? (
                                <p className="empty-history">No guesses yet.</p>
                            ) : (
                                guessHistory.map((item, index) => (
                                    <div key={index} className={`history-item result-${item.result.toLowerCase()}`}>
                                        <span className="history-num">{item.guess}</span>
                                        <span className="history-icon">
                                            {item.result === 'HIGHER' && <ArrowUpCircle size={20} />}
                                            {item.result === 'LOWER' && <ArrowDownCircle size={20} />}
                                            {item.result === 'CORRECT' && <CheckCircle size={20} />}
                                        </span>
                                        <span className="history-text">{item.result}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Area: Keypad Interface */}
                    <div className="keypad-section">
                        <div className="active-header">
                            <div className="secret-display">
                                <span className="secret-label">Your Secret Number:</span>
                                <span className="secret-value">{hlSecret}</span>
                            </div>
                            <div className="header-actions">
                                {!isRevealed && (
                                    <button className="reveal-btn-hl" onClick={handleReveal}>
                                        <Eye size={16} /> Reveal
                                    </button>
                                )}
                                <button className="reset-btn-hl" onClick={handleReset}>
                                    <RotateCcw size={16} /> Reset
                                </button>
                            </div>
                        </div>

                        <div className="keypad-display">
                            <span className="keypad-typed">{keypadInput || '0'}</span>
                        </div>

                        <div className="keypad-grid">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                    key={num}
                                    className="keypad-btn"
                                    onClick={() => handleKeypadPress(num.toString())}
                                    disabled={isRevealed}
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                className="keypad-btn action-btn del-btn"
                                onClick={() => handleKeypadPress('DEL')}
                                disabled={isRevealed || !keypadInput}
                            >
                                <Delete size={24} />
                            </button>
                            <button
                                className="keypad-btn"
                                onClick={() => handleKeypadPress('0')}
                                disabled={isRevealed}
                            >
                                0
                            </button>
                            <button
                                className="keypad-btn action-btn guess-btn-hl"
                                onClick={() => handleKeypadPress('GUESS')}
                                disabled={isRevealed || !keypadInput}
                            >
                                GUESS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isRevealed && (
                <div className="reveal-overlay-hl">
                    <div className="reveal-content-hl">
                        <h3>THE SECRET NUMBER WAS</h3>
                        <h1 className="reveal-text-hl">{opponentHlSecret}</h1>
                        <button className="reset-overlay-btn" onClick={handleReset}>Play Again</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HigherLowerGame;
