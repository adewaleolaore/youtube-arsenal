import { NextRequest, NextResponse } from 'next/server';
import { downloadVideo, processClip } from '@/lib/video-processing';
import { supabaseAdmin } from '@/lib/supabase-admin';
import path from 'path';
import fs from 'fs';
import os from 'os';

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

        // Use system temp directory for processing
        const tempDir = os.tmpdir();

        // Generate unique filename
        const timestamp = Date.now();
        const safeTitle = (title || 'clip').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${safeTitle}_${timestamp}.mp4`;
        const outputPath = path.join(tempDir, filename);

        // 1. Download full video (cached locally if persistent, else redownloaded)
        // note: downloadVideo still writes to <cwd>/public/downloads, 
        // which matches the behavior needed for processing.
        const videoPath = await downloadVideo(videoId);

        // 2. Process clip to temp storage
        await processClip(videoPath, outputPath, startTime, endTime, crop);

        // 3. Upload to Supabase Storage
        const fileContent = fs.readFileSync(outputPath);

        const { error: uploadError } = await supabaseAdmin
            .storage
            .from('clips')
            .upload(filename, fileContent, {
                contentType: 'video/mp4',
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            throw new Error(`Failed to upload to storage: ${uploadError.message}`);
        }

        // 4. Get Public URL
        const { data: { publicUrl } } = supabaseAdmin
            .storage
            .from('clips')
            .getPublicUrl(filename);

        // 5. Cleanup temp file
        try {
            fs.unlinkSync(outputPath);
        } catch (cleanupError) {
            console.warn('Failed to cleanup temp file:', cleanupError);
        }

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
