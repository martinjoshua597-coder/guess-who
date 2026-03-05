-- Run this in your Supabase Dashboard → SQL Editor to fix the matchmaking queue.
-- This fixes the user_id column so random session IDs (UUIDs) can be stored.

-- Step 1: Drop all existing policies that reference user_id (they block the type change)
DROP POLICY IF EXISTS "Own queue row" ON public.matchmaking_queue;
DROP POLICY IF EXISTS "Read waiting rows" ON public.matchmaking_queue;

-- Step 2: Drop the foreign key constraint if it exists
ALTER TABLE public.matchmaking_queue
    DROP CONSTRAINT IF EXISTS matchmaking_queue_user_id_fkey;

-- Step 3: Change the user_id column type from uuid to text
ALTER TABLE public.matchmaking_queue
    ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- Step 4: Disable RLS entirely (no need for policies in our setup)
ALTER TABLE public.matchmaking_queue DISABLE ROW LEVEL SECURITY;

-- Step 5: Ensure Realtime is enabled (safe to run even if already added)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- already added, ignore the error
END$$;

-- Done! The matchmaking queue is ready.
