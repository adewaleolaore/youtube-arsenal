-- Fix database relationships for youtube-arsenal-ai
-- Run this in your Supabase SQL Editor

-- First, let's check if we need to clean up existing data
-- and create proper foreign key relationships

-- Option 1: Add a proper foreign key relationship between videos and clips
-- This assumes both tables use the same video_id field to relate to each other

-- Add foreign key constraint from clips to videos table
-- Since both tables reference YouTube video IDs, we'll create the relationship based on that

-- First, let's check current constraints
SELECT 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
    AND (tc.table_name = 'videos' OR tc.table_name = 'clips');

-- Now let's create the proper relationship
-- We'll modify the clips table to reference the videos table properly

-- Add a video_uuid column to clips that references videos.id
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS video_uuid uuid;

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_clips_video_uuid ON public.clips(video_uuid);

-- Now we need to populate the video_uuid field by matching video_id (YouTube ID)
-- This links clips to their parent videos
-- Handle potential type mismatches by casting appropriately
UPDATE public.clips 
SET video_uuid = v.id
FROM public.videos v 
WHERE clips.video_id = v.video_id 
  AND clips.user_id::text = v.user_id::text
  AND clips.video_uuid IS NULL;

-- Add the foreign key constraint
ALTER TABLE public.clips 
ADD CONSTRAINT fk_clips_video 
FOREIGN KEY (video_uuid) REFERENCES public.videos(id) ON DELETE CASCADE;

-- Update RLS policy for clips to also consider the new relationship
DROP POLICY IF EXISTS "clips_own" ON public.clips;
CREATE POLICY "clips_own" ON public.clips 
  FOR all TO authenticated 
  USING (auth.uid()::text = user_id);

-- Verify the relationships work
SELECT 
    v.title as video_title,
    v.video_id as youtube_id,
    COUNT(c.id) as clip_count
FROM public.videos v
LEFT JOIN public.clips c ON v.id = c.video_uuid
GROUP BY v.id, v.title, v.video_id
ORDER BY v.created_at DESC;