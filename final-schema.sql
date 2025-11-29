-- Clean, minimal schema that works with Supabase auth as-is
-- Run this in Supabase SQL Editor

-- Drop existing tables if they exist (clean slate)
drop table if exists public.thumbnails cascade;
drop table if exists public.clips cascade;
drop table if exists public.videos cascade;
drop table if exists public.profiles cascade;

-- Create profiles table matching auth.users structure
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  token_balance integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create videos table
create table public.videos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
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
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, video_id)
);

-- Create clips table
create table public.clips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  video_id text not null,
  title text not null,
  start_time integer not null,
  end_time integer not null,
  transcript_excerpt text,
  hook_score integer default 0,
  created_at timestamptz default now()
);

-- Create thumbnails table
create table public.thumbnails (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  video_id text,
  image_url text not null,
  prompt text not null,
  edit_type text not null,
  template_dimensions jsonb,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.clips enable row level security;
alter table public.thumbnails enable row level security;

-- RLS Policies
create policy "profiles_own" on public.profiles for all to authenticated using (auth.uid() = id);
create policy "videos_own" on public.videos for all to authenticated using (auth.uid() = user_id);
create policy "clips_own" on public.clips for all to authenticated using (auth.uid() = user_id);
create policy "thumbnails_own" on public.thumbnails for all to authenticated using (auth.uid() = user_id);

-- Useful indexes
create index idx_videos_user_updated on public.videos(user_id, updated_at desc);
create index idx_clips_user on public.clips(user_id);
create index idx_clips_video on public.clips(video_id);

-- Auto-update trigger for videos
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger videos_updated_at
  before update on public.videos
  for each row execute function public.handle_updated_at();