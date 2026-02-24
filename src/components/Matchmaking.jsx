import { useEffect, useRef, useState } from 'react';
import { Radar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Matchmaking.css';

/**
 * Matchmaking — inserts the current user into a Supabase queue table,
 * then subscribes to updates. When a second player joins, both get assigned
 * the same room_id and the match starts.
 *
 * Falls back to simulated 2.5s match if Supabase isn't configured.
 */
const Matchmaking = ({ onMatchFound, currentUserId }) => {
    const [waitTime, setWaitTime] = useState(0);
    const timerRef = useRef(null);
    const queueRowIdRef = useRef(null);
    const channelRef = useRef(null);

    useEffect(() => {
        // Tick up wait time counter
        timerRef.current = setInterval(() => setWaitTime(t => t + 1), 1000);

        const isSupabaseConfigured = !import.meta.env.VITE_SUPABASE_URL?.includes('your-project-id');

        if (isSupabaseConfigured && currentUserId) {
            startRealMatchmaking();
        } else {
            // Fallback: simulate match after 2.5s using a shared dev room ID
            // so testing instances can connect.
            const fallback = setTimeout(() => {
                onMatchFound('room-dev-fallback');
            }, 2500);
            return () => { clearInterval(timerRef.current); clearTimeout(fallback); };
        }

        return () => {
            clearInterval(timerRef.current);
            cleanup();
        };
    }, []);

    const startRealMatchmaking = async () => {
        // Insert into queue
        const { data, error } = await supabase
            .from('matchmaking_queue')
            .insert({ user_id: currentUserId, status: 'waiting' })
            .select()
            .single();

        if (error) {
            console.error('Queue insert error:', error.message);
            // Fall back to simulated shared match if table doesn't exist
            setTimeout(() => onMatchFound('room-dev-fallback'), 2500);
            return;
        }

        queueRowIdRef.current = data.id;

        // Subscribe to our own queue row — server/trigger will fill in room_id when matched
        const channel = supabase
            .channel(`queue-${data.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'matchmaking_queue',
                filter: `id=eq.${data.id}`,
            }, ({ new: row }) => {
                if (row.room_id) {
                    onMatchFound(row.room_id);
                }
            })
            .subscribe();

        channelRef.current = channel;
    };

    const cleanup = async () => {
        if (channelRef.current) supabase.removeChannel(channelRef.current);
        // Remove from queue on cancel
        if (queueRowIdRef.current) {
            await supabase.from('matchmaking_queue').delete().eq('id', queueRowIdRef.current);
        }
    };

    const formatTime = (s) => `0:${String(s).padStart(2, '0')}`;

    return (
        <div className="matchmaking-container">
            <div className="radar-wrapper">
                <Radar size={64} className="radar-icon" />
                <div className="radar-pulse" />
                <div className="radar-pulse delay-1" />
                <div className="radar-pulse delay-2" />
            </div>

            <h2 className="match-title">Searching for opponent...</h2>
            <p className="match-subtitle">Wait time: {formatTime(waitTime)}</p>

            <div className="player-vs">
                <div className="match-player">
                    <div className="match-avatar player-1" />
                    <span>You</span>
                </div>
                <span className="vs-text">VS</span>
                <div className="match-player">
                    <div className="match-avatar empty skeleton" />
                    <span>???</span>
                </div>
            </div>
        </div>
    );
};

export default Matchmaking;
