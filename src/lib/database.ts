import type { Database } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type VideoInsert = Database['public']['Tables']['videos']['Insert'];
type VideoUpdate = Database['public']['Tables']['videos']['Update'];
type ClipInsert = Database['public']['Tables']['clips']['Insert'];

export async function saveVideoData(
  supabase: SupabaseClient<Database>,
  userId: string,
  videoData: {
    youtubeUrl: string;
    videoId: string;
    title: string;
    description?: string;
    transcript?: string;
    duration?: number;
    thumbnailUrl?: string;
  }
) {
  const videoInsert: VideoInsert = {
    user_id: userId,
    youtube_url: videoData.youtubeUrl,
    video_id: videoData.videoId,
    title: videoData.title,
    description: videoData.description || null,
    transcript: videoData.transcript || null,
    duration: videoData.duration || null,
    thumbnail_url: videoData.thumbnailUrl || null,
  };

  const { data, error } = await supabase
    .from('videos')
    .upsert(videoInsert as any, {
      onConflict: 'user_id,video_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving video data:', error);
    throw error;
  }

  return data;
}

export async function updateVideoAnalysis(
  supabase: SupabaseClient<Database>,
  userId: string,
  videoId: string,
  analysis: {
    summary?: string;
    generatedDescription?: string;
    keywords?: string[];
  }
) {
  const update: VideoUpdate = {};
  
  if (analysis.summary) update.summary = analysis.summary;
  if (analysis.generatedDescription) update.generated_description = analysis.generatedDescription;
  if (analysis.keywords) update.keywords = analysis.keywords;
  
  update.updated_at = new Date().toISOString();

  const { data, error } = await (supabase as any)
    .from('videos')
    .update(update)
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .select()
    .single();

  if (error) {
    console.error('Error updating video analysis:', error);
    throw error;
  }

  return data;
}

export async function saveClips(
  supabase: SupabaseClient<Database>,
  userId: string,
  youtubeVideoId: string,
  clips: Array<{
    title: string;
    startTime: number;
    endTime: number;
    transcript: string;
    hookScore?: number;
  }>
) {
  // First, get the video UUID from the YouTube video ID
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('id')
    .eq('user_id', userId)
    .eq('video_id', youtubeVideoId)
    .single();

  if (videoError || !video) {
    console.error('Error finding video for clips:', videoError);
    throw new Error(`Video not found for YouTube ID: ${youtubeVideoId}`);
  }

  // Delete existing clips for this user/video
  await supabase
    .from('clips')
    .delete()
    .eq('user_id', userId)
    .eq('video_uuid', (video as any).id);

  const clipInserts: ClipInsert[] = clips.map(clip => ({
    user_id: userId,
    video_id: youtubeVideoId, // Keep for compatibility
    video_uuid: (video as any).id, // New foreign key
    title: clip.title,
    start_time: clip.startTime,
    end_time: clip.endTime,
    transcript_excerpt: clip.transcript,
    hook_score: clip.hookScore || 0,
  }));

  const { data, error } = await supabase
    .from('clips')
    .insert(clipInserts as any)
    .select();

  if (error) {
    console.error('Error saving clips:', error);
    throw error;
  }

  return data;
}

export async function getUserVideos(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = 20
) {
  // First get the videos
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select(`
      id,
      user_id,
      youtube_url,
      video_id,
      title,
      description,
      transcript,
      duration,
      thumbnail_url,
      summary,
      generated_description,
      keywords,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (videosError) {
    console.error('Error fetching user videos:', videosError);
    throw videosError;
  }

  if (!videos || videos.length === 0) {
    return [];
  }

  // Then get clips for these videos
  const videoIds = videos.map((v: any) => v.id);
  const { data: clips, error: clipsError } = await supabase
    .from('clips')
    .select(`
      id,
      video_uuid,
      title,
      start_time,
      end_time,
      transcript_excerpt,
      hook_score,
      created_at
    `)
    .in('video_uuid', videoIds);

  if (clipsError) {
    console.error('Error fetching clips:', clipsError);
    // Don't throw error, just return videos without clips
  }

  // Combine videos with their clips
  const videosWithClips = videos.map((video: any) => ({
    ...video,
    clips: clips?.filter((clip: any) => clip.video_uuid === video.id) || []
  }));

  return videosWithClips;
}

export async function getVideoWithClips(
  supabase: SupabaseClient<Database>,
  userId: string,
  videoId: string
) {
  // First get the video
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select(`
      id,
      user_id,
      youtube_url,
      video_id,
      title,
      description,
      transcript,
      duration,
      thumbnail_url,
      summary,
      generated_description,
      keywords,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .single();

  if (videoError) {
    console.error('Error fetching video:', videoError);
    throw videoError;
  }

  if (!video) {
    return null;
  }

  // Then get clips for this video
  const { data: clips, error: clipsError } = await supabase
    .from('clips')
    .select(`
      id,
      title,
      start_time,
      end_time,
      transcript_excerpt,
      hook_score,
      created_at
    `)
    .eq('video_uuid', (video as any).id);

  if (clipsError) {
    console.error('Error fetching clips:', clipsError);
    // Don't throw error, just return video without clips
  }

  // Combine video with its clips
  return {
    ...(video as any),
    clips: clips || []
  };
}

// Helper function to get complete video information including all generated content
export async function getCompleteVideoData(
  supabase: SupabaseClient<Database>,
  userId: string,
  videoId: string
) {
  const video = await getVideoWithClips(supabase, userId, videoId);
  
  if (!video) {
    return null;
  }

  // Return structured data with all available information
  return {
    id: video.id,
    youtubeVideoId: video.video_id,
    youtubeUrl: video.youtube_url,
    title: video.title,
    description: video.description,
    generatedDescription: video.generated_description,
    transcript: video.transcript,
    summary: video.summary,
    keywords: video.keywords || [],
    duration: video.duration,
    thumbnailUrl: video.thumbnail_url,
    clips: video.clips?.map((clip: any) => ({
      id: clip.id,
      title: clip.title,
      startTime: clip.start_time,
      endTime: clip.end_time,
      transcript: clip.transcript_excerpt,
      hookScore: clip.hook_score,
      createdAt: clip.created_at,
    })) || [],
    createdAt: video.created_at,
    updatedAt: video.updated_at,
    hasTranscript: !!video.transcript,
    hasSummary: !!video.summary,
    hasGeneratedDescription: !!video.generated_description,
    hasKeywords: !!(video.keywords && video.keywords.length > 0),
    hasClips: !!(video.clips && video.clips.length > 0),
  };
}

// Helper function to get video statistics
export async function getVideoStats(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('id')
    .eq('user_id', userId);

  if (videosError) {
    console.error('Error fetching video stats:', videosError);
    throw videosError;
  }

  const { data: clips, error: clipsError } = await supabase
    .from('clips')
    .select('id')
    .eq('user_id', userId);

  if (clipsError) {
    console.error('Error fetching clip stats:', clipsError);
    throw clipsError;
  }

  return {
    totalVideos: videos?.length || 0,
    totalClips: clips?.length || 0,
  };
}
