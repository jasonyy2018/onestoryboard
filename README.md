# 🎬 Naohaiyi · AI Video Generation Agent

Turn a screenplay into a fully generated video. A multi-agent orchestrator
coordinates **GPT-5 / Claude / Gemini** (text), **Flux Pro 1.1** (images),
**Runway Gen-4 / Kling** (video), **ElevenLabs v3** (audio), and **FFmpeg** (compose)
through a parallel job pipeline backed by **BullMQ + Redis + PostgreSQL**.

> Tech stack verified against latest GitHub releases on **2026-05-12**
> (Next 16.2, Prisma 7.8, Tailwind 4.3, BullMQ 5.76).

---

## ✨ Architecture

```
Browser ──► Next.js Route Handlers ──► BullMQ Flow Producer
                                          │
                                          ├─► parse worker  (Director Agent)
                                          ├─► shot workers  ×N (parallel image+video)
                                          ├─► audio worker  (TTS + music)
                                          └─► compose worker (FFmpeg → MP4)

Real-time UI ◄── SSE (/api/projects/:id/events) ◄── BullMQ QueueEvents
```

The 5-stage pipeline is implemented as a **BullMQ flow tree**: a root `compose`
job has children for every shot and an audio job; once all children complete,
the composer fires automatically.

---

## 🚀 Quick Start

### Prerequisites

* **Node 22+**, **pnpm 10+**, **Docker** + **Docker Compose**.
* At least one set of AI keys: OpenAI **or** Anthropic **or** Google.
* Image+Video keys: Replicate token (covers Flux + Kling + SDXL) and/or Runway.
* Optional: ElevenLabs for audio.

### 1. Clone & install

```powershell
git clone <repo>
cd naohaiyi
pnpm install
```

### 2. Configure

```powershell
copy .env.example .env
# Then edit .env and fill in:
#   POSTGRES_PASSWORD, OPENAI_API_KEY, REPLICATE_API_TOKEN, ...
```

### 3. Start infrastructure (Postgres + Redis)

```powershell
docker compose up -d db redis
```

### 4. Apply DB schema + seed

```powershell
pnpm db:push
pnpm db:seed
```

### 5. Run the app + worker (two terminals)

```powershell
# Terminal 1
pnpm dev

# Terminal 2
pnpm dev:worker
```

Open **http://localhost:3000** and you'll land on the **Projects dashboard**.

---

## 📂 Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── (app)/projects/        ← Dashboard (screen ①)
│   ├── (app)/editor/[id]/     ← Editor (screen ②)
│   ├── (app)/projects/[id]/progress/ ← Progress (screen ③)
│   ├── (app)/projects/[id]/result/   ← Result (screen ④)
│   ├── api/projects/[id]/generate/   POST → kicks off pipeline
│   └── api/projects/[id]/events/     SSE → real-time updates
├── components/
│   ├── editor/           # ScriptEditor, StoryboardPanel
│   ├── pipeline/         # PipelineStepper, ShotGrid, ActivityLog
│   ├── ui/               # Button, Badge (shadcn-style)
│   └── layout/Sidebar.tsx
├── lib/
│   ├── env.ts            # zod-validated env (fail-fast)
│   ├── db.ts             # PrismaClient singleton
│   ├── redis.ts          # ioredis singleton
│   ├── ai/               # text/image/video/audio + retry + storage
│   ├── orchestrator/     # parser/storyboard/character/composer agents
│   └── queue/
│       ├── flows.ts      # BullMQ flow producer
│       └── workers/      # parse / shot / audio / compose workers
└── prisma/schema.prisma  # 8 models, 5 enums
```

---

## 🧪 Reliability rules (enforced)

| Concern | How it's handled |
|---|---|
| Flaky AI providers | `withRetry` (p-retry, exp backoff, 3 attempts) |
| Per-shot isolation | One failing shot doesn't block the others |
| Cost runaway | `Project.totalCost` updated atomically per call |
| Stale outputs | All provider URLs are re-uploaded to our storage |
| Char consistency | Reference portrait stored on `Character.refImageUrl` |
| Schema drift | Zod schemas validate every job payload + AI output |
| Env safety | `lib/env.ts` fails the process on missing required keys |

---

## 🐳 Docker production deploy

```powershell
docker compose up -d --build
```

This brings up:
* `app` (Next.js, port 3000)
* `worker` × 3 replicas (BullMQ — scale freely with `--scale worker=N`)
* `db` (Postgres 17)
* `redis` (Redis 7 with AOF persistence)

Both `app` and `worker` images bake in `ffmpeg` for the composer agent.

---

## 🧰 Useful commands

```powershell
pnpm typecheck       # tsc --noEmit
pnpm lint
pnpm db:studio       # Prisma Studio at :5555
pnpm db:migrate      # create a new migration
```

---

## 🔮 What's not yet implemented (good first contributions)

* CodeMirror 6 syntax highlighting for `@character` / `#prop` / scene headers
* Frame extraction for thumbnails (currently uses first shot URL)
* Per-scene TTS dialogue (audio worker only does music today)
* Auth (currently auto-creates a `demo@naohaiyi.dev` user — wire next-auth or clerk)
* CLIP-score quality gate before accepting an image
* Cancel / pause pipeline buttons (UI ready, action stubs needed)

---

## 📜 License

MIT
