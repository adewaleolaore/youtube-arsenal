# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

AI-powered YouTube content creation suite built on Next.js 15 (App Router). Features: transcript ingestion and summarization, clip/keywords detection, thumbnail generation/editing with Google Gemini, and Supabase-backed auth/session.

## Development Commands

- `npm run dev` — Start dev server (Turbopack)
- `npm run build` — Build production app
- `npm run start` — Run production server
- `npm run lint` — Run ESLint
- `npm run seed:supabase` — Seed Supabase (see scripts/seed-supabase.js)

Environment setup
- Copy `.env.example` to `.env.local`
- Provide required secrets (e.g., GEMINI_API_KEY, Supabase URL/anon key) matching what app code expects

## Architecture (Big Picture)

- App Router (src/app)
  - Pages: `/`, `/login`, `/signup`, `/dashboard`
  - API routes (src/app/api/*) encapsulate backend operations:
    - `/api/generate-image`, `/api/edit-image`: Gemini-backed thumbnail generation/editing
    - `/api/youtube/*`: clips, description, history, keywords, process, summary, transcript — YouTube data workflows
    - Test endpoints: `/api/test-gemini`, `/api/test-youtube`
- Components (src/components)
  - `ThumbnailEditor.tsx`: UI for dual-mode thumbnail generation/editing
- Context (src/contexts)
  - `AuthContext.tsx`: React context providing authenticated session to the app
- Libraries (src/lib)
  - `supabase.ts` + `supabase-server.ts`: client/server helpers for Supabase auth and data
  - `database.ts`: DB-level access helpers
  - `youtube.ts`: YouTube metadata/transcript utilities combining youtubei.js, youtube-transcript, and caption extractor
- Types (src/types)
  - Ambient typing for youtube-caption-extractor
- Middleware (middleware.ts)
  - Enforces auth:
    - Redirects signed-in users away from `/login` and `/signup` to `/dashboard`
    - Protects `/dashboard` and `/api/youtube/*` (401 for API; redirect to `/login` for pages)

## Notable Configuration

- next.config.ts
  - `images.remotePatterns` allows YouTube thumbnail hosts (i.ytimg.com, img.youtube.com)
- tsconfig.json
  - Path alias `@/*` -> `src/*`
- ESLint (eslint.config.mjs)
  - Extends Next core-web-vitals + TypeScript; ignores build/artifact paths

## Common Dev Tasks in this Repo

- Run locally: `npm run dev` then open http://localhost:3000
- Lint code: `npm run lint`
- Build/serve prod: `npm run build && npm run start`
- Seed Supabase: `npm run seed:supabase` (ensure local env points to your Supabase instance)

## Operational Notes

- Image generation/editing uses Google Gemini (@google/generative-ai) and Sharp for post-processing
- YouTube ingestion uses multiple libraries; where possible, network calls are isolated to API routes under `src/app/api/youtube/*`
- Auth is enforced via middleware and Supabase helpers; pages and APIs rely on session checks
