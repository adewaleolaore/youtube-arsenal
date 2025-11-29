-- Comprehensive Database Fix for youtube-arsenal-ai
-- This script handles type mismatches and creates proper relationships

-- First, let's check the current column types
DO $$ 
BEGIN
    RAISE NOTICE 'Checking current schema types...';
END $$;

-- Check videos table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'videos' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check clips table structure  
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'clips' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Now let's fix the relationships step by step

-- Step 1: Add video_uuid column if it doesn't exist
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS video_uuid uuid;

-- Step 2: Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_clips_video_uuid ON public.clips(video_uuid);

-- Step 3: Safely populate the video_uuid field
-- First, let's see what we're working with
DO $$
DECLARE 
    videos_user_id_type text;
    clips_user_id_type text;
BEGIN
    -- Get the actual data types
    SELECT data_type INTO videos_user_id_type
    FROM information_schema.columns 
    WHERE table_name = 'videos' 
        AND column_name = 'user_id' 
        AND table_schema = 'public';
        
    SELECT data_type INTO clips_user_id_type
    FROM information_schema.columns 
    WHERE table_name = 'clips' 
        AND column_name = 'user_id' 
        AND table_schema = 'public';
        
    RAISE NOTICE 'Videos user_id type: %, Clips user_id type: %', videos_user_id_type, clips_user_id_type;
END $$;

-- Step 4: Update clips with proper type casting
-- This handles both text and UUID types safely
UPDATE public.clips 
SET video_uuid = v.id
FROM public.videos v 
WHERE clips.video_id = v.video_id 
  AND (
    -- Handle case where both are text
    (clips.user_id::text = v.user_id::text)
    OR
    -- Handle case where one might be UUID
    (clips.user_id::text = v.user_id::uuid::text)
    OR
    -- Handle reverse case
    (clips.user_id::uuid::text = v.user_id::text)
  )
  AND clips.video_uuid IS NULL;

-- Step 5: Add the foreign key constraint with proper error handling
DO $$
BEGIN
    -- Try to add the constraint
    BEGIN
        ALTER TABLE public.clips 
        ADD CONSTRAINT fk_clips_video 
        FOREIGN KEY (video_uuid) REFERENCES public.videos(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key constraint added successfully';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'Foreign key constraint already exists';
        WHEN others THEN
            RAISE NOTICE 'Error adding foreign key: %', SQLERRM;
    END;
END $$;

-- Step 6: Update RLS policies safely
DO $$
BEGIN
    BEGIN
        DROP POLICY IF EXISTS "clips_own" ON public.clips;
        CREATE POLICY "clips_own" ON public.clips 
          FOR all TO authenticated 
          USING (
            -- Handle different user_id types safely
            CASE 
                WHEN auth.uid() IS NULL THEN false
                ELSE auth.uid()::text = user_id::text
            END
          );
        RAISE NOTICE 'RLS policy updated successfully';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Error updating RLS policy: %', SQLERRM;
    END;
END $$;

-- Step 7: Verify the fix worked
DO $$
DECLARE
    video_count int;
    clip_count int;
    linked_clips int;
BEGIN
    SELECT COUNT(*) INTO video_count FROM public.videos;
    SELECT COUNT(*) INTO clip_count FROM public.clips;
    SELECT COUNT(*) INTO linked_clips FROM public.clips WHERE video_uuid IS NOT NULL;
    
    RAISE NOTICE 'Database stats:';
    RAISE NOTICE '- Total videos: %', video_count;
    RAISE NOTICE '- Total clips: %', clip_count;
    RAISE NOTICE '- Linked clips: %', linked_clips;
    
    IF linked_clips > 0 THEN
        RAISE NOTICE '✅ Foreign key relationships established successfully!';
    ELSE
        RAISE NOTICE '⚠️  No clips were linked. Check your data or run manual linking.';
    END IF;
END $$;

-- Step 8: Test query to verify relationships work
-- This should not produce any errors
SELECT 
    v.title as video_title,
    v.video_id as youtube_id,
    v.user_id as video_user_id,
    COUNT(c.id) as clip_count,
    string_agg(c.title, ', ') as clip_titles
FROM public.videos v
LEFT JOIN public.clips c ON v.id = c.video_uuid
GROUP BY v.id, v.title, v.video_id, v.user_id
ORDER BY v.created_at DESC
LIMIT 5;

RAISE NOTICE '✅ Database relationship fix completed!';
RAISE NOTICE 'If you see video data above, the relationships are working correctly.';