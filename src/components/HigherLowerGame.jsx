import React, { useState } from 'react';
import './HigherLowerGame.css';
import { ArrowUpCircle, ArrowDownCircle, Lock, Eye, RotateCcw, CheckCircle, Delete } from 'lucide-react';

const HigherLowerGame = () => {
    const min = 0;
    const max = 100;

    // States
    const [secretNumber, setSecretNumber] = useState(null);
    const [inputSecret, setInputSecret] = useState('');

    // Keypad game states
    const [keypadInput, setKeypadInput] = useState('');
    const [guessHistory, setGuessHistory] = useState([]); // { guess: Number, result: 'HIGHER' | 'LOWER' | 'CORRECT' }

    const [isRevealed, setIsRevealed] = useState(false);

    const isChoosingSecret = secretNumber === null;

    const handleLockSecret = (e) => {
        e.preventDefault();
        const num = parseInt(inputSecret, 10);
        if (!isNaN(num) && num >= min && num <= max) {
            setSecretNumber(num);
        }
    };

    const handleReveal = () => {
        setIsRevealed(true);
    };

    const handleReset = () => {
        setSecretNumber(null);
        setInputSecret('');
        setKeypadInput('');
        setGuessHistory([]);
        setIsRevealed(false);
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

            if (num < secretNumber) {
                result = 'HIGHER';
            } else if (num > secretNumber) {
                result = 'LOWER';
            } else {
                result = 'CORRECT';
                triggerReveal = true;
            }

            setGuessHistory(prev => [...prev, { guess: num, result }]);
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
                                <span className="secret-value">{secretNumber}</span>
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
                        <h1 className="reveal-text-hl">{secretNumber}</h1>
                        <button className="reset-overlay-btn" onClick={handleReset}>Play Again</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HigherLowerGame;
