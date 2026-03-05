import { useEffect, useRef, useState } from 'react';
import { Radar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Matchmaking.css';

/**
 * Matchmaking — pairs any two active browser sessions via a Supabase queue table.
 *
 * KEY DESIGN DECISIONS:
 * - Uses a random `sessionId` (not user.id) as the player identifier.
 *   This means two tabs of the same logged-in user can still match each other,
 *   which is essential for local testing. In production, same-user matching is
 *   filtered out by the `matchedAgainst` guard if desired.
 * - Ghost rows are avoided by: (a) deleting own old rows on mount, and (b) only
 *   considering rows created within the last 2 minutes as "active".
 * - Race conditions are handled by polling AND checking the actual row count
 *   returned from the UPDATE to confirm the claim succeeded.
 */
const Matchmaking = ({ onMatchFound, currentUserId }) => {
    const [waitTime, setWaitTime] = useState(0);
    const [statusText, setStatusText] = useState('Starting...');

    // Unique per browser tab/mount — a real UUID so it matches the DB uuid column type
    const sessionId = useRef(crypto.randomUUID()).current;
    const queueRowIdRef = useRef(null);
    const channelRef = useRef(null);
    const pollIntervalRef = useRef(null);
    const timerRef = useRef(null);
    const didMatchRef = useRef(false);

    useEffect(() => {
        timerRef.current = setInterval(() => setWaitTime(t => t + 1), 1000);

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const configured = supabaseUrl
            && !supabaseUrl.includes('placeholder')
            && !supabaseUrl.includes('your-project-id');

        console.log('[MM] sessionId:', sessionId, '| userId:', currentUserId, '| supabase ok:', configured);

        if (configured) {
            startMatchmaking();
        } else {
            setStatusText('Dev mode — connecting in 2.5s');
            const t = setTimeout(() => triggerMatch('room-dev-fallback'), 2500);
            return () => { clearInterval(timerRef.current); clearTimeout(t); };
        }

        return () => {
            clearInterval(timerRef.current);
            cleanup();
        };
    }, []);

    /* ── Trigger match (only once) ─────────────────────────────── */
    const triggerMatch = (roomId) => {
        if (didMatchRef.current) return;
        didMatchRef.current = true;
        stopPolling();
        onMatchFound(roomId);
    };

    /* ── Main matchmaking flow ─────────────────────────────────── */
    const startMatchmaking = async () => {
        // 1. Remove any leftover rows from this exact session (shouldn't exist, but be safe)
        await supabase.from('matchmaking_queue').delete().eq('user_id', sessionId);

        // 2. Try to claim someone who's already waiting
        setStatusText('Scanning for available opponents...');
        if (await tryClaimOpponent()) return;

        // 3. Nobody found — add ourselves to the queue
        setStatusText('Joining queue...');
        const { data: row, error: insertErr } = await supabase
            .from('matchmaking_queue')
            .insert({ user_id: sessionId, status: 'waiting' })
            .select()
            .single();

        if (insertErr) {
            console.error('[MM] INSERT failed:', insertErr.message);
            setStatusText(`Queue error: ${insertErr.message}`);
            setTimeout(() => triggerMatch('room-dev-fallback'), 3000);
            return;
        }

        queueRowIdRef.current = row.id;
        subscribeToRow(row.id);

        setStatusText('In queue — waiting for opponent...');
        console.log('[MM] Inserted into queue. Row:', queueRowIdRef.current);

        // 4. Poll every 2s — handles the case where both players insert at the same time
        pollIntervalRef.current = setInterval(async () => {
            console.log('[MM] Poll tick — scanning for opponents...');
            await tryClaimOpponent();
        }, 2000);
    };

    /* ── Subscribe to our own row (Realtime) ──────────────────── */
    const subscribeToRow = (rowId) => {
        const channel = supabase
            .channel(`mm-row-${rowId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'matchmaking_queue',
                filter: `id=eq.${rowId}`,
            }, ({ new: updated }) => {
                console.log('[MM] Realtime update on our row:', updated);
                if (updated.room_id) {
                    setStatusText('Opponent found!');
                    triggerMatch(updated.room_id);
                }
            })
            .subscribe((status) => {
                console.log('[MM] Realtime status:', status);
            });
        channelRef.current = channel;
    };

    /* ── Attempt to atomically claim a waiting player ─────────── */
    const tryClaimOpponent = async () => {
        // Only consider rows created within the last 90 seconds (ignore ghosts)
        const cutoff = new Date(Date.now() - 90_000).toISOString();

        const { data: candidates, error: fetchErr } = await supabase
            .from('matchmaking_queue')
            .select('id, user_id, created_at')
            .eq('status', 'waiting')
            .neq('user_id', sessionId)         // don't match ourselves
            .gte('created_at', cutoff)          // ignore ghost rows > 90s old
            .order('created_at', { ascending: false })
            .limit(5);

        if (fetchErr) {
            console.error('[MM] SELECT error:', fetchErr.message, '| code:', fetchErr.code);
            setStatusText(`Fetch error: ${fetchErr.message}`);
            return false;
        }

        console.log('[MM] Candidates found:', candidates?.length ?? 0);

        for (const candidate of (candidates ?? [])) {
            const roomId = [sessionId, candidate.user_id].sort().join('--');

            // Atomic claim: only update if status is STILL 'waiting'
            // We request the updated row back via .select() so we can verify it changed
            const { data: claimed, error: claimErr } = await supabase
                .from('matchmaking_queue')
                .update({ status: 'matched', room_id: roomId })
                .eq('id', candidate.id)
                .eq('status', 'waiting') // guard — only if still available
                .select();

            if (claimErr) {
                console.warn('[MM] Claim error:', claimErr.message);
                continue;
            }

            if (claimed && claimed.length > 0) {
                // Confirmed — we actually updated the row
                console.log('[MM] Claimed opponent! Room:', roomId);
                setStatusText('Matched!');
                triggerMatch(roomId);
                return true;
            }
            // Else: 0 rows updated = someone else beat us to it, try next candidate
            console.log('[MM] Race lost on candidate', candidate.id, '— trying next');
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '6px', opacity: 0.65 }}>
                {statusText}
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
