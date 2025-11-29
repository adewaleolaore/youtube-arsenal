import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getUserFromServer } from '@/lib/supabase-server';
import { getUserVideos } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = await getUserFromServer();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const videos = await getUserVideos(supabase, user.id, limit);

    return NextResponse.json({
      success: true,
      data: {
        videos: videos.map(video => ({
          id: video.id,
          videoId: video.video_id,
          youtubeUrl: video.youtube_url,
          title: video.title,
          description: video.description,
          thumbnailUrl: video.thumbnail_url,
          duration: video.duration,
          transcript: video.transcript,
          summary: video.summary,
          generatedDescription: video.generated_description,
          keywords: video.keywords || [],
          clips: video.clips?.map((clip: any) => ({
            id: clip.id,
            title: clip.title,
            startTime: clip.start_time,
            endTime: clip.end_time,
            transcript: clip.transcript_excerpt,
            hookScore: clip.hook_score,
            createdAt: clip.created_at,
          })) || [],
          clipsCount: video.clips?.length || 0,
          hasTranscript: !!video.transcript,
          hasSummary: !!video.summary,
          hasGeneratedDescription: !!video.generated_description,
          hasKeywords: !!(video.keywords && video.keywords.length > 0),
          hasClips: !!(video.clips && video.clips.length > 0),
          createdAt: video.created_at,
          updatedAt: video.updated_at,
        }))
      },
      message: 'History retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching history:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}