import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';
import YTDlpWrap from 'yt-dlp-wrap';

// Ensure ffmpeg path is set
if (ffmpegInstaller.path) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

const ytDlpWrap = new YTDlpWrap();

export async function downloadVideo(videoId: string): Promise<string> {
    const downloadDir = path.join(process.cwd(), 'public', 'downloads');
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
    }

    const outputPath = path.join(downloadDir, `${videoId}.mp4`);

    // Check if already exists
    if (fs.existsSync(outputPath)) {
        return outputPath;
    }

    console.log(`Downloading video ${videoId} to ${outputPath}...`);

    return new Promise((resolve, reject) => {
        ytDlpWrap
            .exec([
                'https://www.youtube.com/watch?v=' + videoId,
                '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                '-o', outputPath,
            ])
            .on('error', (error) => reject(error))
            .on('close', () => resolve(outputPath));
    });
}

export async function processClip(
    inputPath: string,
    outputPath: string,
    startTime: number,
    endTime: number,
    cropToVertical: boolean = false
): Promise<void> {
    return new Promise((resolve, reject) => {
        let command = ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(endTime - startTime)
            .output(outputPath);

        if (cropToVertical) {
            // Center crop to 9:16 aspect ratio
            // Assuming 16:9 input (e.g., 1920x1080) -> crop to 608x1080 (centered)
            // crop=w=h*9/16:h:x=(iw-ow)/2:y=0
            command = command.videoFilters('crop=ih*(9/16):ih:(iw-ow)/2:0');
        }

        command
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
}
