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

    // Per-card image upload — attempts Supabase Storage, falls back to local object URL
    const handleCardImageUpload = useCallback(async (faceId, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        setUploadingId(faceId);

        try {
            // Try Supabase Storage first (requires 'card-images' bucket to exist)
            const fileName = `${Date.now()}-${faceId}-${file.name.replace(/\s/g, '_')}`;
            const { data, error } = await supabase.storage
                .from('card-images')
                .upload(fileName, file, { upsert: true });

            let imageUrl;
            if (!error && data) {
                const { data: publicData } = supabase.storage
                    .from('card-images')
                    .getPublicUrl(data.path);
                imageUrl = publicData.publicUrl;
            } else {
                // Fallback: local object URL (won't sync to opponent)
                imageUrl = URL.createObjectURL(file);
                console.warn('Supabase Storage not configured — using local URL (opponent won\'t see this)');
            }

            setFaces(prev => prev.map(f =>
                f.id === faceId
                    ? { ...f, image: imageUrl, name: file.name.split('.')[0] }
                    : f
            ));
        } finally {
            setUploadingId(null);
        }
    }, [faces]);

    const handleUploadIconClick = (e, faceId) => {
        e.stopPropagation();
        fileInputRefs.current[faceId]?.click();
    };

    const handleReveal = () => {
        if (!defendingFaceId) return;
        setIsRevealed(true);
    };

    const handleReset = () => {
        setDefendingFaceId(null);
        setEliminated(new Set());
        setIsRevealed(false);
    };

    const defendingFace = faces.find(f => f.id === defendingFaceId);

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
                                {defendingFace && (
                                    <div className="revealed-face-preview">
                                        <img src={defendingFace.image} alt="Revealed" />
                                        <span>Your card was revealed!</span>
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
