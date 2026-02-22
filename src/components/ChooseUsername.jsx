import { useState } from 'react';
import { UserCircle, ArrowRight } from 'lucide-react';
import './ChooseUsername.css';

const ChooseUsername = ({ onUsernameChosen }) => {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = username.trim();

        if (trimmed.length < 3) {
            setError('Username must be at least 3 characters.');
            return;
        }
        if (trimmed.length > 15) {
            setError('Username cannot exceed 15 characters.');
            return;
        }

        setError('');
        onUsernameChosen(trimmed);
    };

    return (
        <div className="choose-username-container">
            <div className="choose-username-content">
                <div className="icon-wrapper user-icon-bg">
                    <UserCircle size={48} className="header-icon" />
                </div>
                <h2 className="step-title">Set Your Identity</h2>
                <p className="step-subtitle">Choose a unique username that opponents will see.</p>

                <form onSubmit={handleSubmit} className="username-form">
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="e.g., MysteryMaster99"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                if (error) setError('');
                            }}
                            className={`username-input ${error ? 'input-error' : ''}`}
                            autoFocus
                        />
                        {error && <p className="error-text">{error}</p>}
                    </div>

                    <button
                        type="submit"
                        className="continue-btn"
                        disabled={!username.trim() || username.trim().length < 3}
                    >
                        Continue
                        <ArrowRight size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChooseUsername;
