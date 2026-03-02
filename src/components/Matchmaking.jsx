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
    const pollIntervalRef = useRef(null);

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
        // 0. Clean up any stale rows from this exact user (prevent ghost rows)
        await supabase.from('matchmaking_queue').delete().eq('user_id', currentUserId);

        // 1. Try to find someone already waiting (optimistic, fast path)
        const matched = await tryClaimWaitingPlayer();
        if (matched) return;

        // 2. No match yet — insert ourselves into the queue
        const { data: myRow, error: insertError } = await supabase
            .from('matchmaking_queue')
            .insert({ user_id: currentUserId, status: 'waiting' })
            .select()
            .single();

        if (insertError) {
            console.error('Queue insert error:', insertError.message);
            setTimeout(() => onMatchFound('room-dev-fallback'), 2500);
            return;
        }

        queueRowIdRef.current = myRow.id;
        console.log('Inserted into queue, waiting for opponent. Row id:', myRow.id);

        // 3. Subscribe to our own row — in case someone claims us
        const channel = supabase
            .channel(`queue-${myRow.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'matchmaking_queue',
                filter: `id=eq.${myRow.id}`,
            }, ({ new: row }) => {
                console.log('Queue row updated:', row);
                if (row.room_id) {
                    stopPolling();
                    onMatchFound(row.room_id);
                }
            })
            .subscribe((status) => {
                console.log('Queue subscription status:', status);
            });

        channelRef.current = channel;

        // 4. ALSO poll every 2 seconds in case we both inserted at the same time
        //    (neither would trigger an UPDATE on each other without this)
        pollIntervalRef.current = setInterval(async () => {
            const claimed = await tryClaimWaitingPlayer();
            if (claimed) {
                stopPolling();
            }
        }, 2000);
    };

    const tryClaimWaitingPlayer = async () => {
        const { data: waitingPlayers, error: fetchError } = await supabase
            .from('matchmaking_queue')
            .select('*')
            .eq('status', 'waiting')
            .neq('user_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError) {
            console.error('Queue fetch error:', fetchError.message);
            return false;
        }

        if (waitingPlayers && waitingPlayers.length > 0) {
            const match = waitingPlayers[0];
            const roomId = [currentUserId, match.user_id].sort().join('-');
            console.log('Found waiting player, claiming room:', roomId);

            const { error: updateError } = await supabase
                .from('matchmaking_queue')
                .update({ status: 'matched', room_id: roomId })
                .eq('id', match.id)
                .eq('status', 'waiting'); // Only update if still waiting (prevents double-claim)

            if (!updateError) {
                onMatchFound(roomId);
                return true;
            }
            // If updateError — someone else claimed them simultaneously, try again next poll
        }
        return false;
    };

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    };

    const cleanup = async () => {
        stopPolling();
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
