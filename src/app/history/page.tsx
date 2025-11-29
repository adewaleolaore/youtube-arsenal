"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ArrowLeft, Play, Clock, Calendar, Trash2, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface HistoryVideo {
  id: string;
  video_id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  duration?: number;
  transcript?: string;
  summary?: string;
  generated_description?: string;
  keywords?: string[];
  created_at: string;
  updated_at: string;
  clips?: Array<{
    id: string;
    title: string;
    start_time: number;
    end_time: number;
    hook_score: number;
  }>;
}

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [videos, setVideos] = useState<HistoryVideo[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<HistoryVideo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'title'>('recent');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🔍 DEBUG: Starting history fetch...');
        console.log('User object:', user);
        console.log('User ID:', user.id, 'Type:', typeof user.id);
        
        // Test basic connection first
        console.log('Testing Supabase connection...');
        const { data: testData, error: testError } = await supabase
          .from('videos')
          .select('count', { count: 'exact', head: true });
        
        console.log('Connection test result:', { count: testData, error: testError });
        
        // Now try the actual query without the join first
        console.log('Running main query...');
        const { data, error: fetchError } = await supabase
          .from('videos')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        console.log('📊 Query result:', { 
          dataCount: data?.length, 
          data: data?.slice(0, 2), // Show first 2 items
          error: fetchError 
        });

        if (fetchError) {
          console.error('❌ Supabase error details:', {
            message: fetchError.message,
            details: fetchError.details,
            hint: fetchError.hint,
            code: fetchError.code
          });
          throw fetchError;
        }

        console.log('✅ Successfully fetched videos:', data?.length || 0);
        
        // Now fetch clips for each video separately
        let videosWithClips = data || [];
        if (data && data.length > 0) {
          console.log('Fetching clips for videos...');
          const { data: clipsData, error: clipsError } = await supabase
            .from('clips')
            .select('*')
            .eq('user_id', user.id);
          
          console.log('Clips fetch result:', { clipsCount: clipsData?.length, error: clipsError });
          
          if (!clipsError && clipsData) {
            // Group clips by video_id
            const clipsByVideoId = clipsData.reduce((acc, clip) => {
              if (!acc[clip.video_id]) acc[clip.video_id] = [];
              acc[clip.video_id].push({
                id: clip.id,
                title: clip.title,
                start_time: clip.start_time,
                end_time: clip.end_time,
                hook_score: clip.hook_score
              });
              return acc;
            }, {} as Record<string, any[]>);
            
            // Add clips to videos
            videosWithClips = data.map(video => ({
              ...video,
              clips: clipsByVideoId[video.video_id] || []
            }));
          }
        }
        
        setVideos(videosWithClips);
        setFilteredVideos(videosWithClips);
      } catch (err) {
        console.error('Error fetching history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  useEffect(() => {
    let filtered = [...videos];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(video =>
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort videos
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    setFilteredVideos(filtered);
  }, [videos, searchQuery, sortBy]);

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleVideoClick = async (videoId: string) => {
    try {
      const response = await fetch(`/api/video/${videoId}`);
      if (!response.ok) {
        throw new Error('Failed to load video');
      }

      const result = await response.json();
      
      // Store the video data in sessionStorage for the dashboard to pick up
      sessionStorage.setItem('loadedVideoData', JSON.stringify(result.data));
      
      // Navigate to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Error loading video:', error);
      setError('Failed to load video. Please try again.');
    }
  };

  const deleteVideo = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this video and all its clips?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('user_id', user?.id)
        .eq('video_id', videoId);

      if (error) throw error;

      // Remove from local state
      setVideos(prev => prev.filter(v => v.video_id !== videoId));
    } catch (error) {
      console.error('Error deleting video:', error);
      setError('Failed to delete video');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Video History
              </h1>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredVideos.length} videos
              </span>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-64 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'oldest' | 'title')}
                  className="pl-3 pr-8 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                >
                  <option value="recent">Most Recent</option>
                  <option value="oldest">Oldest First</option>
                  <option value="title">Title A-Z</option>
                </select>
                <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-300 dark:bg-gray-600"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery ? 'No videos found' : 'No videos yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchQuery 
                ? `No videos match "${searchQuery}". Try a different search term.`
                : 'Start by processing your first YouTube video on the dashboard.'
              }
            </p>
            <Link 
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => handleVideoClick(video.video_id)}
              >
                {/* Thumbnail */}
                <div className="aspect-video relative bg-gray-100 dark:bg-gray-700">
                  {video.thumbnail_url ? (
                    <Image
                      src={video.thumbnail_url}
                      alt={video.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Duration overlay */}
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded">
                      {formatDuration(video.duration)}
                    </div>
                  )}

                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
                    <div className="bg-white bg-opacity-90 rounded-full p-3">
                      <Play className="w-6 h-6 text-gray-800" />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2 line-clamp-2 text-sm">
                    {video.title}
                  </h3>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(video.created_at)}</span>
                    </div>
                    
                    {video.clips && video.clips.length > 0 && (
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                        {video.clips.length} clips
                      </span>
                    )}
                  </div>

                  {/* Analysis status */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {video.transcript && (
                      <span className="inline-flex items-center text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">
                        Transcript
                      </span>
                    )}
                    {video.summary && (
                      <span className="inline-flex items-center text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded">
                        Summary
                      </span>
                    )}
                    {video.generated_description && (
                      <span className="inline-flex items-center text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded">
                        Description
                      </span>
                    )}
                    {video.keywords && video.keywords.length > 0 && (
                      <span className="inline-flex items-center text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded">
                        Keywords
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://www.youtube.com/watch?v=${video.video_id}`, '_blank');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View on YouTube
                    </button>
                    
                    <button
                      onClick={(e) => deleteVideo(video.video_id, e)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete video"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}