import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { analyzeTranscriptForClips } from '@/lib/youtube';
import { createServerSupabaseClient, getUserFromServer } from '@/lib/supabase-server';
import { saveClips, updateVideoAnalysis } from '@/lib/database';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { title, transcript, duration, videoId } = body;

    const supabase = await createServerSupabaseClient();
    const user = await getUserFromServer();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!title || !transcript) {
      return NextResponse.json(
        { error: 'Video title and transcript are required' },
        { status: 400 }
      );
    }

    console.log('Analyzing transcript for viral clips...');

    // Step 1: Use our algorithm to find potential clips
    const clipSuggestions = analyzeTranscriptForClips(transcript, [], 8, duration);

    if (clipSuggestions.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          clips: [],
          message: 'No viral clip opportunities found in this video'
        }
      });
    }

    console.log('Found ' + clipSuggestions.length + ' potential clips');

    // Step 2: Use AI to enhance clip suggestions
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        topK: 50
      }
    });

    const durationText = duration ? 'Video Duration: ' + Math.floor(duration / 60) + ':' + (duration % 60).toString().padStart(2, '0') : '';
    const transcriptExcerpt = transcript.substring(0, 8000) + (transcript.length > 8000 ? '...(truncated)' : '');

    const clipDescriptions = clipSuggestions.map((clip, i) =>
      (i + 1) + '. "' + clip.title + '" (' + clip.startTime + 's-' + clip.endTime + 's) - Score: ' + clip.hookScore + '\n' +
      '  Reason: ' + clip.reason + '\n' +
      '  Content: "' + clip.transcript.substring(0, 150) + '..."'
    ).join('\n\n');

    const clipsPrompt = 'Based on this YouTube video content, improve these clip suggestions for YouTube Shorts and viral content:\n\n' +
      'Video Title: "' + title + '"\n' +
      durationText + '\n' +
      'Transcript excerpt: "' + transcriptExcerpt + '"\n\n' +
      '      "improvedTitle": "🔥 VIRAL TITLE HERE",\n' +
      '      "startTime": 123,\n' +
      '      "endTime": 178,\n' +
      '      "duration": 55,\n' +
      '      "hookScore": 5,\n' +
      '      "viralPotential": "HIGH/MEDIUM/LOW",\n' +
      '      "reason": "why this clip works",\n' +
      '      "strategy": "posting tips and hashtags",\n' +
      '      "transcript": "actual content from the clip for preview"\n' +
      '    }\n' +
      '  ]\n' +
      '}';

    const clipsResponse = await model.generateContent(clipsPrompt);
    let enhancedClipsText = clipsResponse.response.text();

    // Try to parse JSON response
    let enhancedClips;
    try {
      // Extract JSON from response if wrapped in markdown
      let jsonText = enhancedClipsText;

      // Try to extract from markdown code blocks
      const backtick = String.fromCharCode(96); // backtick character
      const jsonMarker = backtick + backtick + backtick + 'json';
      const codeMarker = backtick + backtick + backtick;

      if (enhancedClipsText.includes(jsonMarker)) {
        const startIndex = enhancedClipsText.indexOf(jsonMarker) + jsonMarker.length;
        const endIndex = enhancedClipsText.indexOf(codeMarker, startIndex);
        if (endIndex > startIndex) {
          jsonText = enhancedClipsText.substring(startIndex, endIndex).trim();
        }
      } else if (enhancedClipsText.includes(codeMarker)) {
        const startIndex = enhancedClipsText.indexOf(codeMarker) + codeMarker.length;
        const endIndex = enhancedClipsText.indexOf(codeMarker, startIndex);
        if (endIndex > startIndex) {
          jsonText = enhancedClipsText.substring(startIndex, endIndex).trim();
        }
      }

      enhancedClips = JSON.parse(jsonText);

      // Ensure transcript content is included from original clips
      if (enhancedClips.clips) {
        enhancedClips.clips = enhancedClips.clips.map((enhancedClip: any, index: number) => ({
          ...enhancedClip,
          transcript: clipSuggestions[index]?.transcript || enhancedClip.transcript || ''
        }));
      }
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, using fallback method');

      // Fallback: Extract titles manually
      const improvedTitles = enhancedClipsText.split('\n')
        .filter(line => line.trim().match(/^[0-9]+\./))
        .map(line => line.replace(/^[0-9]+\.\s*/, '').trim());

      enhancedClips = {
        clips: clipSuggestions.map((clip, index) => ({
          originalTitle: clip.title,
          improvedTitle: improvedTitles[index] || clip.title,
          startTime: clip.startTime,
          endTime: clip.endTime,
          duration: clip.endTime - clip.startTime,
          hookScore: clip.hookScore,
          viralPotential: clip.hookScore >= 4 ? 'HIGH' : clip.hookScore >= 3 ? 'MEDIUM' : 'LOW',
          reason: clip.reason,
          strategy: 'Post during peak hours (7-9 PM), use trending hashtags',
          transcript: clip.transcript // Include the transcript content
        }))
      };
    }

    console.log('Enhanced ' + (enhancedClips.clips?.length || 0) + ' clips');

    // Save clips to database if videoId is provided
    if (videoId && enhancedClips.clips) {
      try {
        await saveClips(supabase, user.id, videoId, enhancedClips.clips.map((clip: any) => ({
          title: clip.improvedTitle || clip.title || 'Untitled Clip',
          startTime: clip.startTime,
          endTime: clip.endTime,
          transcript: clip.transcript,
          hookScore: clip.hookScore || 0
        })));
        console.log('Clips saved to database');
      } catch (dbError) {
        console.error('Error saving clips to database:', dbError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        clips: enhancedClips.clips || [],
        totalClips: enhancedClips.clips?.length || 0,
        highViralPotential: enhancedClips.clips?.filter((c: any) => c.viralPotential === 'HIGH').length || 0
      },
      message: 'Viral clips analyzed and enhanced successfully'
    });

  } catch (error) {
    console.error('Error generating clips:', error);

    if (error instanceof Error) {
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'AI quota exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to generate clips',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}