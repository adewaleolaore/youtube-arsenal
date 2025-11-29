# Fix for "operator does not exist: text = uuid" Error

## The Problem
You're encountering this error:
```
ERROR: 42883: operator does not exist: text = uuid
```

This happens when PostgreSQL tries to compare fields of different types (text vs uuid) without proper casting.

## Solution

### Step 1: Run the Simple Database Fix

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**  
3. Copy and paste the contents of `database-fix-simple.sql`
4. Click **Run**

This script will:
- ✅ Add the `video_uuid` column to the clips table
- ✅ Populate it with proper UUID references to videos
- ✅ Create the foreign key constraint
- ✅ Verify everything is working

### Step 2: Restart Your Development Server

After running the database fix:

```powershell
# Stop your current server (Ctrl+C if running)
# Then restart:
npm run dev
```

### Step 3: Verify the Fix

The error should be gone, and your application should now:

- ✅ Load videos without relationship errors
- ✅ Display all video data (transcripts, summaries, clips, keywords)
- ✅ Show clips associated with each video
- ✅ Work properly with the `/api/video/[id]` endpoint

## What Was Changed

### Database Changes:
1. **Added `video_uuid` column** to clips table that properly references `videos.id`
2. **Populated the relationship** by matching YouTube video IDs between tables
3. **Created foreign key constraint** for data integrity

### Code Changes:
1. **Updated database queries** to use manual joins instead of automatic relationship detection
2. **Enhanced error handling** to gracefully handle missing relationships
3. **Improved type safety** with proper UUID handling

## Testing

Try accessing these endpoints to verify everything works:

1. **Get video list**: `GET /api/youtube/history`
2. **Get specific video**: `GET /api/video/[youtube_video_id]`

Both should now return complete video data including:
- Video details (title, description, duration)
- AI-generated content (summary, keywords, description)
- Full transcript
- All clips with timestamps and hook scores

## If You Still Get Errors

If you still encounter issues:

1. **Check the database migration results** in Supabase SQL Editor
2. **Look for any errors** in the NOTICES section after running the script
3. **Verify your data** using this query in Supabase:
   ```sql
   SELECT COUNT(*) as videos FROM public.videos;
   SELECT COUNT(*) as clips, COUNT(video_uuid) as linked_clips FROM public.clips;
   ```
4. **Check server logs** for any remaining type casting errors

## Why This Approach Works

- **Manual joins** eliminate dependency on Supabase's automatic relationship detection
- **Explicit type casting** prevents UUID/text comparison errors  
- **Graceful error handling** ensures the app works even if some relationships are missing
- **Backward compatibility** maintains existing functionality while adding proper relationships

The application should now work correctly without the UUID/text operator errors!