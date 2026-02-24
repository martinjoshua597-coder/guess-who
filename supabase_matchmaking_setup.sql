-- Run this in your Supabase SQL Editor to enable true random matchmaking!

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'waiting',
    room_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime subscriptions for this table (required for Matchmaking.jsx to hear updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;

-- Disable Row Level Security (RLS) for absolute ease of access during development
ALTER TABLE public.matchmaking_queue DISABLE ROW LEVEL SECURITY;

-- (Optional) Automatically clean up stale waiting players after 5 minutes using pg_cron
-- This ensures the queue doesn't fill up with people who closed their browser
-- NOTE: Requires the pg_cron extension to be enabled in Supabase Database settings
-- SELECT cron.schedule('cleanup_matchmaking', '* * * * *', $$
--    DELETE FROM public.matchmaking_queue WHERE created_at < NOW() - INTERVAL '5 minutes';
-- $$);
