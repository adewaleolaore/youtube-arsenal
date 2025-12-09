# YouTube Arsenal 🚀

**YouTube Arsenal** is an all-in-one AI-powered content creation suite designed to supercharge your YouTube workflow. Built with **Next.js 16**, **Supabase**, and **Google Gemini AI**, it automates the tedious parts of content creation—from transcript analysis to viral clip generation.

![YouTube Arsenal Dashboard](https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop)

## ✨ Key Features

### 🎥 **Video Analysis & Optimization**
- **Transcript Extraction**: Instantly fetch transcripts from any public YouTube video.
- **AI Summaries**: Get concise, engaging summaries of long videos.
- **SEO Description Generator**: Generate optimized descriptions with hooks, timestamps, and hashtags.
- **Keyword Research**: Extract high-impact keywords and tags to boost discoverability.

### ✂️ **Viral Clip Generator**
- **Smart Clip Detection**: AI analyzes transcripts to find the most engaging "hook" moments.
- **Automated Clipping**: Downloads and cuts video segments automatically using `ffmpeg` and `yt-dlp`.
- **Vertical Cropping**: Automatically crops horizontal videos to **9:16 vertical format** for Shorts, TikTok, and Reels.
- **Cloud Storage**: Processed clips are uploaded to **Supabase Storage** for easy sharing and permanent access.

### 🎨 **Advanced Thumbnail Editor**
- **AI Generation**: Create click-worthy thumbnails from text prompts using Gemini AI.
- **Smart Editing**: Upload existing thumbnails and use AI to modify them (e.g., "add a red arrow", "change background to blue").
- **Template Support**: Upload a template layout to ensure generated images match your branding dimensions.

### 🛡️ **Production Ready**
- **Container-Optimized**: Dockerfile included for easy deployment on Railway, Render, or any container platform.
- **Supabase Integration**: Full authentication and database history for all your projects.
- **Robust Error Handling**: Toast notifications and detailed error states for a smooth user experience.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **AI**: Google Gemini Pro & Flash
- **Database & Auth**: Supabase
- **Video Processing**: FFmpeg, yt-dlp, Fluent-FFmpeg
- **Image Processing**: Sharp

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- FFmpeg installed on your system (for local dev)
- Supabase Project
- Google Gemini API Key

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/adewaleolaore/youtube-arsenal.git
    cd youtube-arsenal
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env.local` file:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
    GEMINI_API_KEY=your_gemini_api_key
    ```

4.  **Run Locally**
    ```bash
    npm run dev
    ```

---

## 📦 Deployment

**Note**: This application uses heavy local dependencies (`ffmpeg`, `python`) for video processing. **Serverless platforms like Vercel are NOT recommended** as they will likely time out or fail.

### Recommended: Railway / Render (Docker)
This project includes a production-ready `Dockerfile`.

1.  Push your code to GitHub.
2.  Connect your repository to **Railway** or **Render**.
3.  Set your Environment Variables in the dashboard.
4.  Deploy!

See [DEPLOYMENT.md](./DEPLOYMENT.md) for a detailed guide.

---

## 📝 License

MIT License.
