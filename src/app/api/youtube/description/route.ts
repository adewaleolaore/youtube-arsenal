import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getUserFromServer } from '@/lib/supabase-server';
import { updateVideoAnalysis } from '@/lib/database';

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
    const { title, transcript, summary, originalDescription, videoId } = body;

    const supabase = await createServerSupabaseClient();
    const user = await getUserFromServer();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!title || (!transcript && !summary)) {
      return NextResponse.json(
        { error: 'Video title and either transcript or summary are required' },
        { status: 400 }
      );
    }

    console.log('Generating YouTube description...');

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.8,
        topP: 0.9,
        topK: 40
      }
    });

    // Build prompt using array join to avoid template literal nesting issues
    const promptParts = [
      'Create an engaging YouTube video description based on this video content:',
      '',
      `Video Title: "${title}"`
    ];

    if (summary) {
      promptParts.push(`Summary: "${summary}"`);
    }

    if (transcript) {
      const truncatedTranscript = transcript.substring(0, 8000) + (transcript.length > 8000 ? '...(truncated)' : '');
      promptParts.push(`Transcript: "${truncatedTranscript}"`);
    }

    if (originalDescription) {
      const truncatedDesc = originalDescription.substring(0, 1000);
      promptParts.push(`Original Description: "${truncatedDesc}"`);
    }

    promptParts.push('');
    promptParts.push('Generate a compelling YouTube description that:');
    promptParts.push('- Starts with a hook that makes people want to watch');
    promptParts.push('- Includes key points and value propositions');
    promptParts.push('- Has clear calls-to-action');
    promptParts.push('- Uses proper formatting with line breaks');
    promptParts.push('- Includes relevant hashtags at the end');
    promptParts.push('- Is optimized for YouTube SEO');
    promptParts.push('- DO NOT use emojis');
    promptParts.push('- Keep it professional and engaging');
    promptParts.push('');
    promptParts.push('YouTube Description:');

    const descriptionPrompt = promptParts.join('\n');

    const result = await model.generateContent(descriptionPrompt);
    const response = await result.response;
    const generatedDescription = response.text().trim();

    console.log('Description generated:', generatedDescription.substring(0, 100) + '...');

    // Save to database if videoId is provided
    if (videoId) {
      try {
        await updateVideoAnalysis(supabase, user.id, videoId, {
          generatedDescription
        });
        console.log('Description saved to database');
      } catch (dbError) {
        console.error('Error updating video analysis:', dbError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        description: generatedDescription,
        wordCount: generatedDescription.split(' ').length,
        characterCount: generatedDescription.length
      },
      message: 'YouTube description generated successfully'
    });

  } catch (error) {
    console.error('Error generating description:', error);

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
        error: 'Failed to generate description',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}