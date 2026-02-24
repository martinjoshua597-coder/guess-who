import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const GameContext = createContext(null);

/**
 * GameProvider — manages shared game state between two players via Supabase Realtime.
 * Both players join the same channel (room) and broadcast state changes to each other.
 *
 * roomId: unique room identifier (set by Matchmaking, passed down via App)
 * Usage: wrap the GameSection content with <GameProvider roomId={roomId}>
 */
export const GameProvider = ({ children, roomId, currentUserId }) => {
    const [faces, setFaces] = useState(null);         // null = not yet synced
    const [eliminated, setEliminated] = useState(new Set());
    const [guessHistory, setGuessHistory] = useState([]);
    const [hlSecret, setHlSecret] = useState(null); // Local player's locked secret
    const [opponentHlSecret, setOpponentHlSecret] = useState(null); // Opponent's locked secret
    const [revealedFaceId, setRevealedFaceId] = useState(null); // Which face identity was revealed

    const [opponentReady, setOpponentReady] = useState(false);
    const channelRef = useRef(null);
    const isHostRef = useRef(false);

    useEffect(() => {
        if (!roomId) return;

        // Join the Supabase Realtime channel for this room
        const channel = supabase.channel(`game-room:${roomId}`, {
            config: { broadcast: { self: false } }
        });

        channelRef.current = channel;

        // Listen for face updates (card image changes)
        channel.on('broadcast', { event: 'faces_update' }, ({ payload }) => {
            setFaces(payload.faces);
        });

        // Listen for elimination updates
        channel.on('broadcast', { event: 'eliminated_update' }, ({ payload }) => {
            setEliminated(new Set(payload.eliminated));
        });

        // Listen for guess history syncs (Higher/Lower)
        channel.on('broadcast', { event: 'guess_update' }, ({ payload }) => {
            setGuessHistory(payload.guessHistory);
        });

        // Listen for Higher/Lower secret number lock
        channel.on('broadcast', { event: 'hl_secret_update' }, ({ payload }) => {
            setOpponentHlSecret(payload.secret);
        });

        // Listen for Mystery Face revealed identity
        channel.on('broadcast', { event: 'reveal_update' }, ({ payload }) => {
            setRevealedFaceId(payload.faceId);
        });

        // Listen for presence (opponent online status)
        channel.on('presence', { event: 'join' }, ({ newPresences }) => {
            const others = newPresences.filter(p => p.userId !== currentUserId);
            if (others.length > 0) setOpponentReady(true);
        });

        channel.on('presence', { event: 'leave' }, () => {
            // Could show "opponent disconnected" toast here
        });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ userId: currentUserId, online: true });
            }
        });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, currentUserId]);

    // Broadcast face change to opponent
    const broadcastFacesUpdate = useCallback((updatedFaces) => {
        channelRef.current?.send({
            type: 'broadcast',
            event: 'faces_update',
            payload: { faces: updatedFaces },
        });
    }, []);

    // Broadcast elimination change
    const broadcastEliminationUpdate = useCallback((eliminatedSet) => {
        channelRef.current?.send({
            type: 'broadcast',
            event: 'eliminated_update',
            payload: { eliminated: Array.from(eliminatedSet) },
        });
    }, []);

    // Broadcast guess history (Higher/Lower)
    const broadcastGuessUpdate = useCallback((history) => {
        channelRef.current?.send({
            type: 'broadcast',
            event: 'guess_update',
            payload: { guessHistory: history },
        });
    }, []);

    // Broadcast Higher/Lower local secret lock to opponent
    const broadcastHlSecret = useCallback((secret) => {
        channelRef.current?.send({
            type: 'broadcast',
            event: 'hl_secret_update',
            payload: { secret },
        });
    }, []);

    // Broadcast Mystery Face reveal
    const broadcastReveal = useCallback((faceId) => {
        channelRef.current?.send({
            type: 'broadcast',
            event: 'reveal_update',
            payload: { faceId },
        });
    }, []);

    return (
        <GameContext.Provider value={{
            faces, setFaces,
            eliminated, setEliminated,
            guessHistory, setGuessHistory,
            hlSecret, setHlSecret,
            opponentHlSecret, setOpponentHlSecret,
            revealedFaceId, setRevealedFaceId,
            opponentReady,
            broadcastFacesUpdate,
            broadcastEliminationUpdate,
            broadcastGuessUpdate,
            broadcastHlSecret,
            broadcastReveal,
        }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const ctx = useContext(GameContext);
    // Returns null gracefully when used outside provider (solo/no-room mode)
    return ctx;
};
