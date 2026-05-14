# Project Brief · AI Short Drama Generator（Vibe Coding）

面向 **Cursor / Windsurf** 等 AI 编辑器的**结构化项目指令**。实现目标、技术栈、目录、Agent 拓扑、Prompt 文件位置与数据库映射均以此为准。

---

## 1. Goal

全栈 AI Agent 流水线（Next.js + Tailwind + PostgreSQL + Docker + pnpm），自动化 **AI 短剧** 生产：

1. 导入小说或标准剧本（`Project.rawScript`，语言 `Project.language`: `zh` | `en`）。
2. **按集 / 场解析** — 场次结构 + **约 15 秒/镜** 的 `Shot` 行（Episode = 集；镜 = 生成最小单位）。
3. **MRI 资产** — 角色、场景、道具参考图（一致性锚点）。
4. **双提示词（ECP）** — 每镜写入 **`imagePrompt`**（多格真人制片板 · 生图侧）与 **`videoPrompt`**（Seedance 图生视频侧）。
5. **Part 1** — 用 `imagePrompt` + `prompts/part1-storyboard.{zh,en}.md` 生成制片板静帧（代码入口 `storyboardKeyframeUserPrompt`）。
6. **Part 2** — 用 `videoPrompt` + `prompts/part2-seedance.{zh,en}.md`，以 **制片板成图为首张参考图 + MRI**，走 **Seedance 2.0**（**`generate_audio: true`**）。
7. **FFmpeg** 按集拼接多段 MP4，**音频 AAC**（`src/lib/orchestrator/composer.agent.ts`）。

---

## 2. Tech Stack

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 16（App Router）+ TypeScript |
| UI | Tailwind CSS 4、Radix 基础组件（`src/components/ui`） |
| 数据库 | PostgreSQL（Docker）+ Prisma（`prisma/schema.prisma`） |
| 队列 | Redis + BullMQ（`src/lib/queue/`） |
| Agent 编排 | **LangGraph**（`src/lib/langgraph/`）表达同步阶段拓扑；**长耗时 I2V** 仍在 BullMQ `shot` / `compose` worker |
| 媒体 | `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg`；对象存储见 `src/lib/ai/storage.ts` |
| 包管理 | pnpm；容器见 `Dockerfile` + `docker-compose.yml` |

---

## 3. Prompt 资产（中英文）

| 文件 | 用途 |
|------|------|
| `prompts/part1-storyboard.zh.md` | 中文 · Part 1 制片板 / 分镜表图总锁；占位符 `{{LOCK_TEXT}}` = 该镜 ECP `imagePrompt` 正文 |
| `prompts/part1-storyboard.en.md` | English · same |
| `prompts/part2-seedance.zh.md` | 中文 · Part 2 Seedance 导演封装 + 原生音轨说明；`{{ROW_SCRIPT}}` = 行内场景/人物/运镜/情绪块 |
| `prompts/part2-seedance.en.md` | English · same |

加载与替换：`src/lib/prompts/load-template.ts`；Seedance 外层封装：`src/lib/prompts/seedance-row-prompt.ts`。

**约定**：修改视觉/音频策略时**优先改 markdown**，再跑 `pnpm typecheck`；勿只在聊天里粘贴大段 Prompt 而脱离仓库。

---

## 4. Agent Workflow（LangGraph + BullMQ）

| Brief 中的 Agent | 实现位置 | 说明 |
|------------------|----------|------|
| ScriptParserAgent | `runParseAndStoryboard`（`src/lib/orchestrator/director.ts`） | 小说/剧本 → Scene + Character；再 ECP → `Shot` 行 |
| StoryboardAgent（结构化提示） | `generateStoryboard` + `runEcpStoryboardForProject` | 写入 `Shot.imagePrompt` / `videoPrompt` |
| StoryboardAgent（Part 1 成图） | BullMQ `shot` worker 前半段 | `storyboardKeyframeUserPrompt` + `generateImage` |
| VideoGeneratorAgent | BullMQ `shot` worker 后半段 | `wrapSeedancePart2Template` + `generateVideo(..., generateAudio: true)` |
| ContinuityChecker | `continuityCheckerNode`（`src/lib/langgraph/nodes.ts`） | **当前为 stub**，可后续接一致性校验 |
| ComposerAgent | BullMQ `compose` worker | `composeFinalVideo` → `Project.episodeFinals` |

**LangGraph 拓扑**（同步边界 + 派发队列）：`src/lib/langgraph/graph.ts`  
**入口**（与原先 parse worker 行为等价）：`invokeShortDramaPipeline(projectId)`（`src/lib/langgraph/index.ts`）  
parse worker：`src/lib/queue/workers/parse.worker.ts` 已改为调用该入口。

---

## 5. Database（Prisma）— Brief 概念 ↔ 物理表

Brief 中的理想模型与当前库表对应关系（**无需重复建表**即可对齐文档）：

| Brief | 物理模型 |
|-------|----------|
| Project | `Project` |
| Script | `Project.rawScript` + `Project.language` |
| Segment（~15s 镜） | `Shot`（`duration` 默认 15；`sceneId` + `order`） |
| Asset（图/视频 URL） | `Shot.imageUrl`、`Shot.videoUrl`（持久化 key / URL） |
| Episode（集成片） | `Scene.episodeNumber` + `Project.episodeFinals`（JSON 多集成片） |

---

## 6. 关键源码索引

- 环境变量校验：`src/lib/env.ts`（`VOLCENGINE_ARK_API_KEY`、`DEFAULT_VIDEO_MODEL=seedance-2.0` 等）
- 队列派发：`src/lib/queue/flows.ts`（`dispatchPipeline`、`fanoutAssetsAndCompose`）
- Seedance 请求体：`src/lib/ai/video.ts`（`generate_audio` 映射）
- 分镜表图 Prompt：`src/lib/orchestrator/storyboard-keyframe.ts`
- 视频 Prompt 组装：`src/lib/queue/workers/shot.worker.ts`

---

## 7. Instruction for AI Assistant

- 分镜表图与 Seedance 的**外层政策**以 `prompts/part*.md` 为准；行内变量由 TS 注入。
- Seedance 调用须 **`generateAudio: true`**（已在 `shot.worker` 显式传入）。
- FFmpeg 拼接须保留音轨并 **AAC**（已在 `composer.agent.ts`）。
- 迭代时 `@PROJECT_BRIEF.md` 与本节一并引用，避免遗忘 Agent 顺序与文件位置。

### 本地运行（摘要）

```bash
pnpm install
docker compose up -d db redis
pnpm prisma db push
pnpm dev          # Next
pnpm dev:worker   # BullMQ workers（需与 app 相同 DATABASE_URL / REDIS_URL）
```

---

## 8. 给 AI 编辑器的打开方式

1. 将本文件置于仓库根目录（已存在）。
2. 在聊天中输入：`@PROJECT_BRIEF.md 按 §4 调整 LangGraph 节点并说明与 BullMQ 的边界`。
3. 改 Prompt 时同时 `@prompts/part1-storyboard.zh.md`（或 en）避免漂移。
