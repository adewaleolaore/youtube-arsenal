# Database Relationship Fix Instructions

## Problem
The application was failing with the error:
```
Could not find a relationship between 'videos' and 'clips' in the schema cache
```

This happened because there was no proper foreign key relationship between the `videos` and `clips` tables that Supabase could automatically detect for joins.

## Solution Overview

1. **Database Schema Changes**: Added a proper foreign key relationship between `videos` and `clips` tables
2. **Code Updates**: Updated all database queries to use the new relationship structure
3. **API Enhancements**: Enhanced API responses to include all video data (clips, transcripts, summaries, keywords, descriptions)

## Steps to Apply the Fix

### Step 1: Run Database Migration

1. Open your Supabase dashboard
2. Go to the SQL Editor
3. Run the SQL script in `database-fix.sql`:

```sql
-- This will:
-- - Add a video_uuid column to clips table
-- - Populate it with proper foreign key references
-- - Create the foreign key constraint
-- - Update indexes for performance
```

### Step 2: Verify Database Changes

After running the migration, verify it worked by running this query in Supabase SQL Editor:

```sql
-- Test the relationship
SELECT 
    v.title as video_title,
    v.video_id as youtube_id,
    COUNT(c.id) as clip_count
FROM public.videos v
LEFT JOIN public.clips c ON v.id = c.video_uuid
GROUP BY v.id, v.title, v.video_id
ORDER BY v.created_at DESC
LIMIT 10;
```

### Step 3: Code Changes Applied

The following files have been updated:

1. **`src/lib/database.ts`**:
   - Updated `saveClips()` to use the new foreign key relationship
   - Enhanced `getUserVideos()` and `getVideoWithClips()` to use proper joins
   - Added `getCompleteVideoData()` helper function
   - Added `getVideoStats()` helper function

2. **`src/lib/supabase.ts`**:
   - Updated TypeScript types to include `video_uuid` field

3. **`src/app/api/video/[id]/route.ts`**:
   - Updated to use new `getCompleteVideoData()` function
   - Enhanced error handling

4. **`src/app/api/youtube/history/route.ts`**:
   - Fixed to properly pass Supabase client
   - Enhanced response to include all video data

## What You'll Now Have Access To

### For Each Video:
- ✅ **Basic Info**: title, description, duration, thumbnail
- ✅ **Generated Content**: AI summary, generated description, keywords
- ✅ **Transcript**: Full video transcript
- ✅ **Clips**: All generated viral clips with:
  - Title, start/end times
  - Transcript excerpts
  - Hook scores
  - Timestamps
- ✅ **Metadata**: Creation/update timestamps, processing status flags

### API Endpoints Enhanced:

1. **`GET /api/video/[id]`** - Returns complete video data including:
   ```json
   {
     "success": true,
     "data": {
       "id": "uuid",
       "youtubeVideoId": "video_id",
       "title": "Video Title",
       "transcript": "Full transcript...",
       "summary": "AI-generated summary...",
       "generatedDescription": "AI-generated description...",
       "keywords": ["keyword1", "keyword2"],
       "clips": [
         {
           "id": "clip_uuid",
           "title": "Clip Title",
           "startTime": 30,
           "endTime": 60,
           "transcript": "Clip transcript...",
           "hookScore": 85
         }
       ],
       "hasTranscript": true,
       "hasSummary": true,
       "hasClips": true
     }
   }
   ```

2. **`GET /api/youtube/history`** - Returns all videos with complete data

## Testing the Fix

1. Start your development server: `npm run dev`
2. The relationship errors should be resolved
3. Test accessing video data through the API endpoints
4. Verify that all generated content (clips, summaries, etc.) is accessible

## Notes

- The migration preserves all existing data
- Backward compatibility is maintained with the old `video_id` field
- Performance is improved with proper indexes
- All video processing results are now easily accessible through the API

## Troubleshooting

If you encounter any issues:

1. **Check the migration ran successfully** in Supabase dashboard
2. **Verify foreign key constraints** exist in the database
3. **Check server logs** for any remaining database errors
4. **Ensure TypeScript types are updated** by restarting your development server