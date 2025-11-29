import { NextRequest, NextResponse } from 'next/server';
import { 
  extractVideoId, 
  isValidYouTubeUrl, 
  getVideoMetadata, 
  getVideoTranscript 
} from '@/lib/youtube';
import { createServerSupabaseClient, getUserFromServer } from '@/lib/supabase-server';
import { saveVideoData } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { youtubeUrl } = body;

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      );
    }

    // Validate YouTube URL
    if (!isValidYouTubeUrl(youtubeUrl)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Could not extract video ID from URL' },
        { status: 400 }
      );
    }

    console.log(`Extracting transcript for video: ${videoId}`);

    // Require authentication
    const supabase = await createServerSupabaseClient();
    const user = await getUserFromServer();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get video metadata
    let metadata;
    try {
      metadata = await getVideoMetadata(videoId);
      console.log(`Retrieved metadata for: ${metadata.title}`);
    } catch {
      return NextResponse.json(
        { error: 'Failed to fetch video metadata. Video may be private or unavailable.' },
        { status: 400 }
      );
    }

    // Get transcript
    let transcript;
    try {
      transcript = await getVideoTranscript(videoId);
      console.log(`Retrieved transcript (${transcript.length} characters)`);
    } catch {
      return NextResponse.json(
        { error: 'Failed to fetch video transcript. Video may not have captions available.' },
        { status: 400 }
      );
    }

    // Save to database
    try {
      await saveVideoData(supabase, user.id, {
        youtubeUrl,
        videoId,
        title: metadata.title,
        description: metadata.description,
        transcript,
        duration: metadata.duration,
        thumbnailUrl: metadata.thumbnail,
      });
      console.log('Video data saved to database');
    } catch (dbError) {
      console.error('Error saving video data:', dbError);
      // Don't fail the request if database save fails
    }

    return NextResponse.json({
      success: true,
      data: {
        videoId,
        youtubeUrl,
        metadata: {
          title: metadata.title,
          description: metadata.description,
          duration: metadata.duration,
          thumbnail: metadata.thumbnail,
          author: metadata.author,
          viewCount: metadata.viewCount,
          uploadDate: metadata.uploadDate
        },
        transcript: transcript.substring(0, 10000) + (transcript.length > 10000 ? '...(truncated for response)' : ''),
        fullTranscriptLength: transcript.length,
        fullTranscript: transcript // Include full transcript for other tools
      },
      message: 'Transcript extracted successfully'
    });

  } catch (error) {
    console.error('Error extracting transcript:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to extract transcript',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}