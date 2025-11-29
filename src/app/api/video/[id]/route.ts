import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getUserFromServer } from '@/lib/supabase-server';
import { getCompleteVideoData } from '@/lib/database';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = await getUserFromServer();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const videoId = params.id;
    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    console.log(`Loading complete video data: ${videoId}`);

    const videoData = await getCompleteVideoData(supabase, user.id, videoId);
    
    if (!videoData) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: videoData
    });

  } catch (error) {
    console.error('Error loading video:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to load video',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}