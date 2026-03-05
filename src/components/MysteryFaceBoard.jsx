import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Eye, RotateCcw, Trophy, Camera, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useGame } from '../context/GameContext';
import './MysteryFaceBoard.css';

// Default 20 characters using pravatar placeholders
const generateDefaultFaces = () => Array.from({ length: 20 }).map((_, i) => ({
    id: i.toString(),
    name: `Face ${i + 1}`,
    image: `https://i.pravatar.cc/150?img=${i + 1}`
}));

const MysteryFaceBoard = () => {
    const game = useGame(); // null when not in a live room

    const [localFaces, setLocalFaces] = useState(generateDefaultFaces());
    const [eliminated, setEliminated] = useState(new Set());
    const [defendingFaceId, setDefendingFaceId] = useState(null);
    const [isRevealed, setIsRevealed] = useState(false);
    const [uploadingId, setUploadingId] = useState(null); // tracks which card slot is uploading

    const fileInputRefs = useRef({});

    // Use synced faces if in a live room, otherwise local
    const faces = game?.faces || localFaces;
    const setFaces = (updater) => {
        const newFaces = typeof updater === 'function' ? updater(faces) : updater;
        setLocalFaces(newFaces);
        game?.setFaces(newFaces);
        game?.broadcastFacesUpdate(newFaces); // sync to opponent
    };

    // Sync incoming face changes from opponent
    useEffect(() => {
        if (game?.faces && game.faces !== localFaces) {
            setLocalFaces(game.faces);
        }
    }, [game?.faces]);

    // Sync incoming eliminations from opponent
    useEffect(() => {
        if (game?.eliminated) {
            setEliminated(game.eliminated);
        }
    }, [game?.eliminated]);

    const isSelectingDefendingFace = defendingFaceId === null;

    const handleFaceClick = (id) => {
        if (isRevealed) return;
        if (isSelectingDefendingFace) {
            setDefendingFaceId(id);
        } else {
            setEliminated(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id);
                else newSet.add(id);
                game?.broadcastEliminationUpdate(newSet); // sync elimination to opponent
                return newSet;
            });
        }
    };

    // Compress an image file to a data URL using Canvas
    const compressImage = (file, maxPx = 400, quality = 0.7) =>
        new Promise((resolve) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(objectUrl);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
            img.src = objectUrl;
        });

    // Per-card image upload — compresses client-side and sends P2P (no storage used)
    const handleCardImageUpload = useCallback(async (faceId, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        setUploadingId(faceId);
        try {
            const dataUrl = await compressImage(file);
            if (!dataUrl) return;

            // Update own board instantly
            setFaces(prev => (prev || []).map(f =>
                f.id === faceId ? { ...f, image: dataUrl, name: file.name.split('.')[0] } : f
            ));

            // Send compressed image directly to opponent via WebRTC data channel
            game?.sendP2PData({ type: 'card_image', faceId, dataUrl });
        } finally {
            setUploadingId(null);
        }
    }, [game]);


    const handleUploadIconClick = (e, faceId) => {
        e.stopPropagation();
        fileInputRefs.current[faceId]?.click();
    };

    const handleReveal = () => {
        if (!defendingFaceId) return;
        if (game) {
            game.setRevealedFaceId(defendingFaceId);
            game.broadcastReveal(defendingFaceId);
        } else {
            setIsRevealed(true);
        }
    };

    // Listen for opponent's reveal (or our own, propagated back via context)
    useEffect(() => {
        if (game?.revealedFaceId && game.revealedFaceId !== 'higher_lower') {
            setIsRevealed(true);
            // If the opponent revealed, their face id comes through.
            // If we don't know who revealed it, we just show the game over screen.
        }
    }, [game?.revealedFaceId]);

    const handleReset = () => {
        setDefendingFaceId(null);
        setEliminated(new Set());
        if (game) {
            game.setRevealedFaceId(null);
            // Only reset local faces to default if we want a full game restart,
            // but for now let's just reset the state of the current board.
        } else {
            setIsRevealed(false);
        }
    };

    const defendingFace = faces.find(f => f.id === defendingFaceId);

    // Determine which face to show on the game over screen
    const revealedFaceIdToDisplay = game?.revealedFaceId && game.revealedFaceId !== 'higher_lower'
        ? game.revealedFaceId
        : defendingFaceId;
    const revealedFaceToDisplay = faces.find(f => f.id === revealedFaceIdToDisplay);
    const isRevealLocal = revealedFaceIdToDisplay === defendingFaceId;

    return (
        <div className="mystery-board-container">
            <div className="board-header">
                <h3 className="section-title">
                    {isSelectingDefendingFace ? 'Select Your Defending Face' : 'Mystery Face Board'}
                </h3>
                {game?.opponentReady && (
                    <span className="opponent-online-badge">● Opponent Online</span>
                )}
            </div>

            <div className="board-layout">
                <div className="character-grid-wrapper">
                    <div className={`character-grid ${isRevealed ? 'game-over' : ''}`}>
                        {faces.map(char => (
                            <div
                                key={char.id}
                                className={`
                                    character-card
                                    ${eliminated.has(char.id) ? 'eliminated' : ''}
                                    ${isSelectingDefendingFace ? 'selectable' : ''}
                                    ${isRevealed && char.id === defendingFaceId ? 'revealed-highlight' : ''}
                                `}
                                onClick={() => handleFaceClick(char.id)}
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden-input"
                                    ref={el => fileInputRefs.current[char.id] = el}
                                    onChange={(e) => handleCardImageUpload(char.id, e)}
                                />

                                <img src={char.image} alt={char.name} className="char-image" />
                                <div className="char-overlay" />

                                {!isRevealed && (
                                    <button
                                        className="card-upload-btn"
                                        onClick={(e) => handleUploadIconClick(e, char.id)}
                                        title="Upload custom photo"
                                        disabled={uploadingId === char.id}
                                    >
                                        {uploadingId === char.id
                                            ? <Loader size={12} className="spin" />
                                            : <Camera size={14} />
                                        }
                                    </button>
                                )}

                                {isSelectingDefendingFace && (
                                    <div className="select-badge">Select</div>
                                )}
                            </div>
                        ))}
                    </div>

                    {isRevealed && (
                        <div className="game-complete-overlay">
                            <div className="game-complete-content">
                                <Trophy size={48} className="trophy-icon" />
                                <h2 className="game-complete-title">GAME COMPLETE</h2>
                                {revealedFaceToDisplay && (
                                    <div className="revealed-face-preview">
                                        <img src={revealedFaceToDisplay.image} alt="Revealed" />
                                        <span>{isRevealLocal ? "Your card was revealed!" : "Opponent's card was revealed!"}</span>
                                    </div>
                                )}
                                <button className="play-again-btn" onClick={handleReset}>
                                    <RotateCcw size={18} />
                                    Play Again
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="side-panel">
                    <div className="my-card-section">
                        <h3 className="section-title">Your Card</h3>
                        {defendingFace ? (
                            <div className="my-card">
                                <img src={defendingFace.image} alt="Defending Face" className="char-image" />
                                <div className="my-card-label">Defending</div>
                                {!isRevealed && (
                                    <button className="reveal-btn" onClick={handleReveal}>
                                        <Eye size={14} /> Reveal Identity
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="my-card placeholder-card">
                                <span className="placeholder-text">Click a face on the board</span>
                            </div>
                        )}
                    </div>

                    <div className="action-section">
                        <h3 className="section-title">Controls</h3>
                        <button className="ask-btn">Ask Question</button>
                        <button className="guess-btn">Make a Guess</button>
                        {(!isSelectingDefendingFace || isRevealed) && (
                            <button className="reset-mf-btn" onClick={handleReset} style={{ marginTop: '12px' }}>
                                Reset Game
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MysteryFaceBoard;
