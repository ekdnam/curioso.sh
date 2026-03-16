# curioso.sh

An AI-powered course generator that creates university-level curricula on any topic. Enter a subject and difficulty level, and curioso.sh produces a full 10-week course with lecture notes, readings, glossaries, and deep dives — then keeps generating more as you scroll.

## Features

- **Progressive course generation** — Skeleton-first loading shows course structure instantly, then fills in content week by week
- **Infinite scroll** — Scroll past week 10 and the system automatically generates new weeks, with AI-predicted topic roadmaps
- **Smart prefetching** — Velocity-aware prefetch pipeline buffers upcoming weeks based on scroll speed
- **Glossary with inline highlights** — Technical terms are auto-extracted and shown as hover tooltips within lecture notes
- **Deep dives** — Each week includes 2-3 explorable deep dive topics with on-demand content generation
- **PDF export** — Download the full course as a formatted PDF
- **File-based caching** — Glossaries and deep dives are cached per-topic to avoid redundant API calls

## Tech Stack

- **React 19** / **Next.js 16** (App Router)
- **Tailwind CSS 4**
- **Framer Motion** for animations
- **Google Gemini** (`gemini-3-flash-preview`) for all AI generation
- **TypeScript** with strict mode

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/apikey)

### Setup

```bash
git clone https://github.com/ekdnam/curioso.sh.git
cd curioso.sh
npm install
```

Create a `.env.local` file:

```
GEMINI_API_KEY=your_api_key_here
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
app/
  api/                  # POST endpoints for Gemini calls
    generate-course/    # Main course generation (chunked or single-shot)
    generate-skeleton/  # Quick course outline for skeleton-first loading
    generate-glossary/  # Term extraction from lecture notes
    generate-deep-dive-summaries/  # 2-3 deep dive topics per week
    generate-deep-dive-content/    # Full content for a single deep dive
    generate-roadmap/   # Batch-predicts next N topic suggestions
    prefilter-topic/    # Validates and refines user input
    recommend-next-topic/  # Single next-topic recommendation
  page.tsx              # Main page orchestrating all hooks
components/             # UI components (WeekCard, DeepDiveDrawer, etc.)
hooks/                  # Client orchestration
  useProgressiveCourse  # Skeleton → content progressive loading pipeline
  useInfiniteScroll     # Generates weeks beyond 10 on scroll
  usePrefetchPipeline   # Velocity-aware prefetch buffer
  useRoadmap            # Batch topic prediction for infinite scroll
  useScrollVelocity     # Tracks scroll speed for dynamic prefetch sizing
lib/                    # Utilities (caching, retry, logging, PDF export)
types/                  # TypeScript interfaces
```

## Configuration

Feature flags in `lib/config.ts`:

| Flag | Default | Description |
|------|---------|-------------|
| `progressiveLoading` | `true` | Skeleton-first loading with per-week content fill |
| `infiniteScroll` | `true` | Generate weeks beyond 10 on scroll |
| `prefetchRecommendations` | `true` | Proactively buffer upcoming weeks |
| `deepDiveMode` | `"full"` | `"full"` (inline), `"bundled"` (on-demand), or `"separate"` |
| `prefetchCount` | `3` | Weeks to keep buffered ahead |
| `roadmapBatchSize` | `20` | Topics to predict per roadmap batch |

## License

MIT
