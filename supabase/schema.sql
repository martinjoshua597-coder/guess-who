-- =============================================================
-- Mystery Duel — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Matchmaking Queue
--    Players insert themselves when searching for a match.
--    A server-side function pairs them and assigns a room_id.
-- ---------------------------------------------------------------
create table if not exists public.matchmaking_queue (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'waiting',   -- 'waiting' | 'matched'
  room_id     text,                               -- filled in when matched
  created_at  timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.matchmaking_queue enable row level security;

-- Players can only see and modify their own queue row
create policy "Own queue row" on public.matchmaking_queue
  for all using (auth.uid() = user_id);

-- Enable Realtime on this table (so the client gets notified when room_id is filled)
alter publication supabase_realtime add table public.matchmaking_queue;

-- ---------------------------------------------------------------
-- 2. Matchmaking function + trigger
--    Runs every time a new row is inserted with status='waiting'.
--    Finds another waiting player, pairs them, and assigns a room_id.
-- ---------------------------------------------------------------
create or replace function public.match_players()
returns trigger language plpgsql security definer as $$
declare
  other_row record;
  new_room  text;
begin
  -- Find another waiting player (not the current one)
  select * into other_row
  from public.matchmaking_queue
  where status = 'waiting'
    and user_id != new.user_id
  order by created_at asc
  limit 1
  for update skip locked;

  if found then
    new_room := 'room-' || gen_random_uuid()::text;

    -- Update both rows to matched
    update public.matchmaking_queue
    set status = 'matched', room_id = new_room
    where id in (new.id, other_row.id);
  end if;

  return new;
end;
$$;

create or replace trigger on_player_join
  after insert on public.matchmaking_queue
  for each row execute function public.match_players();

-- ---------------------------------------------------------------
-- 3. Card Images bucket (for Supabase Storage)
--    Create via Dashboard → Storage → New Bucket, name: card-images
--    OR run this if the storage extension is enabled:
-- ---------------------------------------------------------------
-- insert into storage.buckets (id, name, public)
-- values ('card-images', 'card-images', true)
-- on conflict do nothing;

-- Allow any authenticated user to upload/read card images
create policy "Public card images" on storage.objects
  for all using (bucket_id = 'card-images');
