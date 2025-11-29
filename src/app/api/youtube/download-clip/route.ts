import { NextRequest, NextResponse } from 'next/server';
import { downloadVideo, processClip } from '@/lib/video-processing';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { videoId, startTime, endTime, crop, title } = body;

        if (!videoId || startTime === undefined || endTime === undefined) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // Create clips directory if it doesn't exist
        const clipsDir = path.join(process.cwd(), 'public', 'clips');
        if (!fs.existsSync(clipsDir)) {
            fs.mkdirSync(clipsDir, { recursive: true });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const safeTitle = (title || 'clip').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${safeTitle}_${timestamp}.mp4`;
        const outputPath = path.join(clipsDir, filename);

        // 1. Download full video (cached)
        const videoPath = await downloadVideo(videoId);

        // 2. Process clip
        await processClip(videoPath, outputPath, startTime, endTime, crop);

        // 3. Return public URL
        const publicUrl = `/clips/${filename}`;

        return NextResponse.json({
            success: true,
            data: {
                url: publicUrl,
                filename: filename
            }
        });

    } catch (error) {
        console.error('Error generating clip:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate clip',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
