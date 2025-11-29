-- First, let's check what type auth.users.id is
-- Run this query first to see the column type:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'id';

-- Enable UUID generator (usually enabled by default on Supabase)
create extension if not exists "uuid-ossp";

-- Determine the correct ID type by checking auth.users
DO $$ 
DECLARE 
    auth_id_type text;
BEGIN
    SELECT data_type INTO auth_id_type 
    FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'id';
    
    RAISE NOTICE 'auth.users.id type is: %', auth_id_type;
END $$;

-- 1) PROFILES
-- Use text for ID to be compatible with both UUID and bigint
create table if not exists public.profiles (
  id text primary key,
  email text not null unique,
  full_name text,
  avatar_url text,
  token_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Profiles policies (user can read/update only their own row)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid()::text);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid()::text);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid()::text)
with check (id = auth.uid()::text);

-- 2) VIDEOS (history for each processed YouTube video)
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  youtube_url text not null,
  video_id text not null,
  title text not null,
  description text,
  transcript text,
  duration integer,
  thumbnail_url text,
  summary text,
  generated_description text,
  keywords text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint videos_user_video_unique unique (user_id, video_id)
);

alter table public.videos enable row level security;

-- Videos policies (owner-only access)
drop policy if exists "videos_select_own" on public.videos;
create policy "videos_select_own"
on public.videos for select
to authenticated
using (user_id = auth.uid()::text);

drop policy if exists "videos_insert_own" on public.videos;
create policy "videos_insert_own"
on public.videos for insert
to authenticated
with check (user_id = auth.uid()::text);

drop policy if exists "videos_update_own" on public.videos;
create policy "videos_update_own"
on public.videos for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

drop policy if exists "videos_delete_own" on public.videos;
create policy "videos_delete_own"
on public.videos for delete
to authenticated
using (user_id = auth.uid()::text);

-- Helpful indexes
create index if not exists idx_videos_user_updated_at on public.videos(user_id, updated_at desc);
create index if not exists idx_videos_video_id on public.videos(video_id);

-- 3) CLIPS (viral clips per video)
create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  video_id text not null,
  title text not null,
  start_time integer not null,
  end_time integer not null,
  transcript_excerpt text,
  hook_score integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.clips enable row level security;

-- Clips policies (owner-only)
drop policy if exists "clips_select_own" on public.clips;
create policy "clips_select_own"
on public.clips for select
to authenticated
using (user_id = auth.uid()::text);

drop policy if exists "clips_insert_own" on public.clips;
create policy "clips_insert_own"
on public.clips for insert
to authenticated
with check (user_id = auth.uid()::text);

drop policy if exists "clips_update_own" on public.clips;
create policy "clips_update_own"
on public.clips for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

drop policy if exists "clips_delete_own" on public.clips;
create policy "clips_delete_own"
on public.clips for delete
to authenticated
using (user_id = auth.uid()::text);

-- Helpful indexes for clips
create index if not exists idx_clips_user on public.clips(user_id);
create index if not exists idx_clips_video on public.clips(video_id);

-- 4) THUMBNAILS (generated/edited images)
create table if not exists public.thumbnails (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  video_id text,
  image_url text not null,
  prompt text not null,
  edit_type text not null, -- e.g., "generate" | "edit"
  template_dimensions jsonb, -- store width/height or preset info
  created_at timestamptz not null default now()
);

alter table public.thumbnails enable row level security;

-- Thumbnails policies (owner-only)
drop policy if exists "thumbnails_select_own" on public.thumbnails;
create policy "thumbnails_select_own"
on public.thumbnails for select
to authenticated
using (user_id = auth.uid()::text);

drop policy if exists "thumbnails_insert_own" on public.thumbnails;
create policy "thumbnails_insert_own"
on public.thumbnails for insert
to authenticated
with check (user_id = auth.uid()::text);

drop policy if exists "thumbnails_update_own" on public.thumbnails;
create policy "thumbnails_update_own"
on public.thumbnails for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

drop policy if exists "thumbnails_delete_own" on public.thumbnails;
create policy "thumbnails_delete_own"
on public.thumbnails for delete
to authenticated
using (user_id = auth.uid()::text);

create index if not exists idx_thumbnails_user_created on public.thumbnails(user_id, created_at desc);

-- 5) Optional: trigger to auto-update updated_at on videos
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_videos_updated_at on public.videos;
create trigger trg_videos_updated_at
before update on public.videos
for each row
execute procedure public.set_updated_at();