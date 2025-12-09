# YouTube Arsenal - Deployment Guide

## Overview
**YouTube Arsenal** (formerly `image-editor`) is an AI-powered content creation suite built with Next.js 16. It leverages local video processing tools (`ffmpeg`, `yt-dlp`) to download, transcribe, analyze, and clip YouTube videos.

## 1. Repository Rename
To rename the repository to **YouTube Arsenal**:

1.  Go to your GitHub Repository "Settings" tab.
2.  In the "General" section, find "Repository name".
3.  Change it to `youtube-arsenal` and click "Rename".
4.  Update your local git remote:
    ```bash
    git remote set-url origin https://github.com/adewaleolaore/youtube-arsenal.git
    ```

## 2. Deployment Recommendations

### ⚠️ Critical Architecture Note
This application performs heavy **local video processing** (downloading binaries, writing video files to disk, running FFmpeg).
- **Vercel / Netlify (Serverless):** **NOT RECOMMENDED** for the current architecture.
    - Serverless functions have 10-60s timeouts (processing takes longer).
    - Read-only file systems (cannot download `yt-dlp` or save videos to `public/downloads`).
    - Binary size limits.
- **Railway / Render / DigitalOcean (Containers):** **HIGHLY RECOMMENDED**.
    - Persistent (or at least writable) filesystem.
    - No strict execution timeouts.
    - Can install system dependencies (Python, FFmpeg) easily.

### Option A: Railway (Recommended)
Railway is the easiest way to deploy this full-stack app.

1.  **Create a Project** on [secondary]Railway[/secondary].
2.  **Connect GitHub Repo**.
3.  **Configure Environment Variables** (see below).
4.  **Add a `Dockerfile`** (Recommended for control) or use their Nixpacks builder (might need config for ffmpeg).

#### Recommended `Dockerfile` for Railway/Render
Create a `Dockerfile` in the root (if not present) to ensure system dependencies:
```dockerfile
FROM node:20-slim

# Install FFmpeg, Python (for yt-dlp), and other build deps
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Option B: Render (Alternative)
Similar to Railway. Deploy as a "Web Service" using the Docker runtime.

## 3. Environment Variables
Set these in your deployment platform settings:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase Service Role Key (for secure backend ops) |
| `GOOGLE_API_KEY` | Gemini AI API Key |

## 4. Production Considerations
1.  **Storage:** Currently, the app saves processed videos to `public/downloads`. In most container deployments (Railway/Render), these files are **ephemeral** (lost on restart).
    - **Recommendation:** Refactor to upload processed clips to **Supabase Storage** (S3 compatible) and serve them via public URL.
2.  **Concurrency:** Video processing is CPU intensive. A small container instance might only handle 1 processing job at a time.