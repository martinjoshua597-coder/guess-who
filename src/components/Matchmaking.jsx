import { useEffect, useRef, useState } from 'react';
import { Radar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Matchmaking.css';

/**
 * Matchmaking — inserts the current user into a Supabase queue table,
 * then polls for a match every 2 seconds and subscribes via Realtime.
 *
 * Falls back to simulated 2.5s match if Supabase isn't configured or user isn't logged in.
 */
const Matchmaking = ({ onMatchFound, currentUserId }) => {
    const [waitTime, setWaitTime] = useState(0);
    const [debugStatus, setDebugStatus] = useState('Starting...');
    const timerRef = useRef(null);
    const queueRowIdRef = useRef(null);
    const channelRef = useRef(null);
    const pollIntervalRef = useRef(null);
    const matchedRef = useRef(false); // prevent calling onMatchFound twice

    useEffect(() => {
        timerRef.current = setInterval(() => setWaitTime(t => t + 1), 1000);

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('your-project-id') && !supabaseUrl.includes('placeholder');

        console.log('[Matchmaking] currentUserId:', currentUserId);
        console.log('[Matchmaking] isSupabaseConfigured:', isSupabaseConfigured);
        console.log('[Matchmaking] supabaseUrl:', supabaseUrl);

        if (isSupabaseConfigured && currentUserId) {
            setDebugStatus('Connecting to matchmaking...');
            startRealMatchmaking();
        } else {
            const reason = !isSupabaseConfigured ? 'Supabase not configured' : 'No user ID found';
            setDebugStatus(`Fallback mode (${reason}) — connecting in 2.5s`);
            console.warn('[Matchmaking] Falling back. reason:', reason);
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

    const handleMatchFound = (roomId) => {
        if (matchedRef.current) return;
        matchedRef.current = true;
        stopPolling();
        onMatchFound(roomId);
    };

    const startRealMatchmaking = async () => {
        // 0. Clean up stale rows for this user
        setDebugStatus('Clearing old queue entries...');
        const { error: deleteError } = await supabase
            .from('matchmaking_queue')
            .delete()
            .eq('user_id', currentUserId);
        if (deleteError) console.warn('[Matchmaking] delete error (non-fatal):', deleteError.message);

        // 1. Fast path: look for someone already waiting
        setDebugStatus('Looking for waiting opponent...');
        const claimed = await tryClaimWaitingPlayer();
        if (claimed) return;

        // 2. Insert ourselves
        setDebugStatus('Joining queue...');
        const { data: myRow, error: insertError } = await supabase
            .from('matchmaking_queue')
            .insert({ user_id: currentUserId, status: 'waiting' })
            .select()
            .single();

        if (insertError) {
            console.error('[Matchmaking] Insert error:', insertError.message, insertError.code);
            setDebugStatus(`Insert failed: ${insertError.message} — using fallback`);
            setTimeout(() => handleMatchFound('room-dev-fallback'), 2500);
            return;
        }

        queueRowIdRef.current = myRow.id;
        setDebugStatus('In queue — waiting for opponent...');
        console.log('[Matchmaking] Inserted into queue. Row id:', myRow.id);

        // 3. Subscribe to our own row
        const channel = supabase
            .channel(`queue-${myRow.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'matchmaking_queue',
                filter: `id=eq.${myRow.id}`,
            }, ({ new: row }) => {
                console.log('[Matchmaking] Queue row updated via Realtime:', row);
                if (row.room_id) {
                    setDebugStatus('Opponent found via Realtime!');
                    handleMatchFound(row.room_id);
                }
            })
            .subscribe((status) => {
                console.log('[Matchmaking] Realtime subscription status:', status);
                if (status === 'CHANNEL_ERROR') {
                    setDebugStatus('Realtime error — relying on polling only');
                }
            });

        channelRef.current = channel;

        // 4. Poll every 2 seconds (handles simultaneous join race condition)
        pollIntervalRef.current = setInterval(async () => {
            console.log('[Matchmaking] Polling for opponent...');
            const found = await tryClaimWaitingPlayer();
            if (found) stopPolling();
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
            console.error('[Matchmaking] Fetch error:', fetchError.message, fetchError.code);
            setDebugStatus(`Fetch error: ${fetchError.message}`);
            return false;
        }

        console.log('[Matchmaking] Waiting players found:', waitingPlayers?.length ?? 0);

        if (waitingPlayers && waitingPlayers.length > 0) {
            const match = waitingPlayers[0];
            const roomId = [currentUserId, match.user_id].sort().join('-');
            console.log('[Matchmaking] Claiming opponent. Room:', roomId);
            setDebugStatus('Opponent found! Claiming match...');

            const { error: updateError } = await supabase
                .from('matchmaking_queue')
                .update({ status: 'matched', room_id: roomId })
                .eq('id', match.id)
                .eq('status', 'waiting');

            if (!updateError) {
                handleMatchFound(roomId);
                return true;
            }
            console.warn('[Matchmaking] Claim race — opponent already taken, retrying next poll');
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

            {/* Debug status — shows exactly what step we're on */}
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '8px', opacity: 0.7 }}>
                {debugStatus}
            </p>

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
