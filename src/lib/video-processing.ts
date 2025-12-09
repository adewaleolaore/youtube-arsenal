import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';
import os from 'os';
import YTDlpWrap from 'yt-dlp-wrap';

// Ensure ffmpeg path is set
if (ffmpegInstaller.path) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

// Initialize with a specific path for the binary
const ytDlpBinaryPath = path.join(process.cwd(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const ytDlpWrap = new YTDlpWrap(ytDlpBinaryPath);

export async function downloadVideo(videoId: string): Promise<string> {
    // Ensure yt-dlp binary exists
    if (!fs.existsSync(ytDlpBinaryPath)) {
        console.log('Downloading yt-dlp binary...');
        await YTDlpWrap.downloadFromGithub(ytDlpBinaryPath);
        console.log('yt-dlp binary downloaded.');
    }

    const downloadDir = path.join(os.tmpdir(), 'youtube-downloads');
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
        const args = [
            'https://www.youtube.com/watch?v=' + videoId,
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '-o', outputPath,
        ];

        // Pass ffmpeg location to yt-dlp if available
        if (ffmpegInstaller.path) {
            args.push('--ffmpeg-location', ffmpegInstaller.path);
        }

        ytDlpWrap
            .exec(args)
            .on('error', (error) => {
                console.error('yt-dlp error:', error);
                reject(error);
            })
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
