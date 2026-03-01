# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Infinite Tutor (Kalpana) is an AI-powered course generation app. Users enter a topic and difficulty level, and the system generates a 10-week university-level curriculum with lecture notes, readings, deep dives, and glossaries using Google's Gemini API.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint (flat config, next/core-web-vitals + next/typescript)
```

No test framework is configured.

## Environment

Requires `GEMINI_API_KEY` in `.env.local`.

## Architecture

Single Next.js app (App Router) with React 19, Tailwind CSS 4, and TypeScript (strict mode).

### API Routes (`app/api/`)

All routes are POST endpoints that call Google Gemini (`gemini-3-flash-preview`) with JSON schema validation via `@google/generative-ai` SchemaType. Each route follows the same pattern: validate input, check cache, call Gemini with structured output schema, return JSON.

- **generate-course** — Main generation endpoint. Can produce weeks in chunks (1-2, then 3-6 and 7-10 in parallel) or all 10 in a single shot depending on `singleShotCourse` flag.
- **prefilter-topic** — Validates/refines user topic input before generation.
- **generate-glossary** — Extracts technical terms from lecture notes per week. Cached.
- **generate-deep-dive-summaries** — Generates 2-3 deep dive topics per week. Cached.
- **generate-deep-dive-content** — Full content for a single deep dive. Cached.

### Client Orchestration (`hooks/`)

`useGenerateCourse` is the main orchestration hook. It drives the full pipeline: prefilter → generate course (chunked or single-shot) → fetch glossaries (staggered) → fetch deep dive summaries. Course state persists to localStorage under key `"infinite-tutor:course"`.

### Feature Flags (`lib/config.ts`)

- `deepDiveMode`: `"full"` (inline during generation), `"separate"` (fetched after), or `"bundled"` (summaries generated, content on-demand)
- `singleShotCourse`: `true` = all 10 weeks in one API call; `false` = chunked parallel generation

### Caching

File-based cache at `.cache/gemini/{topic_slug}/{namespace}-{key}.json`. Used for glossary, deep dive summaries, and deep dive content. Cache is per-topic.

### Key Libraries

- `framer-motion` — Spring animations (deep dive drawer)
- `jspdf` — PDF export (`lib/exportPDF.ts`)
- `geminiRetry` (`lib/geminiRetry.ts`) — Retry with exponential backoff for Gemini calls

## Conventions

- Components use `"use client"` directive when interactive
- PascalCase for component files, camelCase for utilities/hooks
- Path alias `@/*` maps to project root
- Logging via `lib/logger.ts` with structured output (INFO/ERROR/PERF levels)
