-- Simple Database Fix for youtube-arsenal-ai
-- This approach avoids complex type casting and creates a straightforward relationship

-- Step 1: Add the video_uuid column to clips table
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS video_uuid uuid;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_clips_video_uuid ON public.clips(video_uuid);

-- Step 3: Populate video_uuid using a safer approach
-- First, let's check what data we have
SELECT 
    'videos' as table_name,
    COUNT(*) as count,
    array_agg(DISTINCT user_id::text) as sample_user_ids
FROM public.videos
UNION ALL
SELECT 
    'clips' as table_name,
    COUNT(*) as count,
    array_agg(DISTINCT user_id::text) as sample_user_ids
FROM public.clips;

-- Step 4: Safe update using text casting for both sides
UPDATE public.clips 
SET video_uuid = v.id::uuid
FROM public.videos v 
WHERE clips.video_id = v.video_id 
  AND clips.user_id::text = v.user_id::text
  AND clips.video_uuid IS NULL;

-- Step 5: Verify the linking worked
SELECT 
    COUNT(*) as total_clips,
    COUNT(video_uuid) as linked_clips,
    COUNT(*) - COUNT(video_uuid) as unlinked_clips
FROM public.clips;

-- Step 6: Add foreign key constraint
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.clips 
        ADD CONSTRAINT fk_clips_video_uuid 
        FOREIGN KEY (video_uuid) REFERENCES public.videos(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Foreign key constraint added successfully';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE '⚠️  Foreign key constraint already exists';
        WHEN others THEN
            RAISE NOTICE '❌ Error adding foreign key: %', SQLERRM;
            RAISE NOTICE 'This might be due to orphaned clips. Check the verification query above.';
    END;
END $$;

-- Step 7: Test the relationship with a simple query
SELECT 
    v.title,
    v.video_id as youtube_id,
    COUNT(c.id) as clip_count
FROM public.videos v
LEFT JOIN public.clips c ON v.id = c.video_uuid
GROUP BY v.id, v.title, v.video_id
ORDER BY v.created_at DESC
LIMIT 5;

-- Step 8: Clean up any orphaned clips (optional)
-- Uncomment the following if you want to remove clips that couldn't be linked
-- DELETE FROM public.clips WHERE video_uuid IS NULL;

RAISE NOTICE '✅ Simple database fix completed!';
RAISE NOTICE 'Your application should now work without the "operator does not exist: text = uuid" error.';