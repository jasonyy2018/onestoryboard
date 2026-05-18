# Statement of Work (SOW) · OneStoryboard

**项目名称：** OneStoryboard — AI 全自动短剧生成平台
**项目版本：** v1.0
**编制日期：** 2026-05-18
**编制人：** WSAI

---

## 1. 项目概述

### 1.1 背景

短剧（Short Drama）市场快速增长，但传统制作流程周期长、成本高、人力密集。OneStoryboard 旨在构建一套 **AI 驱动的全自动化短剧生产线**：用户只需提供小说或剧本，即可端到端生成带有分镜、配音、视频的成品短剧。

### 1.2 愿景

打造一个面向内容创作者和短剧制片人的 SaaS 平台，以**分钟级**速度完成传统需要**数周**的短剧制作流程，同时保证角色一致性、镜头连贯性和画面质量。

---

## 2. 项目目标

1. **端到端自动化**：从原始文本（小说/剧本）到成品 MP4 视频，全流程零人工干预。
2. **多集/系列支持**：支持单集项目和连续剧模式，自动按「集」切分长文本。
3. **视觉一致性**：通过 MRI（角色/场景/道具）参考图体系，确保跨镜头角色外观统一。
4. **双提示词引擎（ECP）**：每镜独立生成 `imagePrompt`（制片板静帧）与 `videoPrompt`（图生视频），解耦生图与生视频两个环节。
5. **中英双语**：系统界面与 AI 提示词均支持中文和英文。
6. **实时进度反馈**：通过 SSE（Server-Sent Events）向用户推送流水线各阶段状态。

---

## 3. 技术栈

| 层级 | 技术选型 | 用途 |
|------|----------|------|
| **框架** | Next.js 16 (App Router) + TypeScript 5.7 | 全栈 Web 框架 |
| **UI** | React 19 + Tailwind CSS 4 + Radix UI + Lucide Icons | 用户界面 |
| **数据库** | PostgreSQL 17 + Prisma 5.22 | 持久化存储 |
| **缓存/队列** | Redis 7 + BullMQ 5.76 | 异步任务队列 |
| **Agent 编排** | LangGraph 1.3 (LangChain) | 多 Agent 状态机编排 |
| **媒体处理** | FFmpeg + fluent-ffmpeg | 视频拼接与编码 |
| **包管理** | pnpm 10 | 依赖管理 |
| **容器化** | Docker + Docker Compose | 生产部署 |
| **对象存储** | Local / Vercel Blob / S3 (R2/MinIO) | 媒体文件持久化 |

### AI 服务依赖

| 能力 | 主服务商 | 备选/回退 |
|------|----------|-----------|
| **文本生成** | 火山引擎 ARK (DeepSeek V3 Flash) | — |
| **图像生成** | 腾讯云 VOD (OG Image 2) | 阿里云 DashScope (万相 2.7) |
| **视频生成** | 火山引擎 ARK (Seedance 2.0 Fast) | — |
| **TTS 配音** | ElevenLabs v3 | — |
| **资产库** | 火山引擎 Asset Library | — |

---

## 4. 功能范围

### 4.1 In Scope — 包含功能

#### 4.1.1 项目管理
- 项目创建（标题、原始剧本/小说、语言、集数、模型配置）
- 项目列表、搜索、状态筛选
- 项目删除、暂停、恢复、取消
- 项目状态机：DRAFT → GENERATING → PAUSED / COMPLETED / FAILED / CANCELLED
- 流水线阶段追踪：IDLE → PARSING → STORYBOARDING → ASSET_GENERATION → AUDIO → COMPOSING → DONE

#### 4.1.2 剧本解析
- 原始文本解析为结构化场次（Scene）与角色（Character）
- 角色 / 场景 / 道具三要素提取（Asset Extraction）
- 场次规范化（Normalize Drama Script）
- 单集 JSON 剧本生成（Episode Script）

#### 4.1.3 资产生成（MRI 体系）
- 角色定妆照生成（含 Volcengine 资产库注入）
- 场景参考图生成
- 道具参考图生成
- 批量资产生成与单资产重新生成
- 资产确认流程（用户审核后继续管线）

#### 4.1.4 分镜引擎（ECP）
- 每镜自动生成 `imagePrompt`（制片板静帧提示词）
- 每镜自动生成 `videoPrompt`（视频生成提示词）
- 提示词包含镜头语言（景别/运镜/角度/灯光/情绪）
- 角色一致性绑定（ethnicity 控制：中文项目 → 东亚面孔）

#### 4.1.5 AI 媒体生成
- **Part 1**：12 格制片板静帧图（Tencent OG Image 2 / Alibaba Wanxiang 回退）
- **Part 2**：Seedance 2.0 Fast 图生视频（以制片板为第一张参考图 + MRI 资产图，开启原生音轨 `generate_audio: true`）
- 自动重试与错误回退机制（去参考图降级）

#### 4.1.6 视频合成
- FFmpeg 按集拼接全部镜头
- libx264 编码 + AAC 音频
- faststart 优化（Web 流式播放）
- 输出每集成品 MP4 + JSON `episodeFinals`

#### 4.1.7 系列管理
- 系列创建（SERIAL 逐集追加 / FULL 一次性全部分析）
- 系列角色池共享（SeriesCharacter 跨集复用）
- 系列列表与详情页

#### 4.1.8 编辑器
- 剧本文本编辑器
- 分镜双提示词预览面板（ECP imagePrompt + videoPrompt 并排展示）
- 单镜状态查看

#### 4.1.9 实时进度
- SSE 事件流推送（项目级 `events` 端点）
- 流水线 Stepper 组件（阶段可视化）
- Shot Grid 组件（每镜缩略图 + 状态色标）
- 活动日志

#### 4.1.10 资产管理页面
- 角色资产库（CRUD + 重新生成 + 注入 Volcengine）
- 场景资产库
- 道具资产库

#### 4.1.11 系统功能
- 健康检查端点 `/api/health`
- BullMQ 队列统计 `/api/queue/stats`
- 多语言 i18n（中文/英文 UI）
- 敏感词过滤（Safety Layer）

### 4.2 Out of Scope — 不含功能

| 功能 | 说明 |
|------|------|
| **用户注册/登录/认证系统** | 当前为单用户模式，无 Auth 中间件 |
| **多租户/SaaS 计费** | 无支付、订阅、用量计费逻辑 |
| **用户管理后台** | 无 Admin 面板 |
| **社交分享/发布** | 不支持一键发布到抖音/快手等平台 |
| **在线视频编辑器** | 不支持用户手动剪辑/调整时间线 |
| **实时语音克隆** | ElevenLabs TTS 未深度集成 |
| **第三方 AI 模型管理后台** | 不支持用户自定义 API 模型配置（仅在 `.env` 硬编码） |
| **移动端 App** | 仅 Web 端，无 React Native / Flutter |

---

## 5. 系统架构

### 5.1 整体架构图（文本描述）

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Browser                              │
│  ┌───────────┬────────────┬──────────────┬──────────────────────┐  │
│  │ Projects   │  Editor    │  Series      │  Assets              │  │
│  └─────┬─────┴─────┬──────┴──────┬───────┴──────────────────────┘  │
│        │           │             │                                  │
│        └───────┬───┴─────┬───────┘                                  │
│                │  Server │ Actions + Route Handlers                │
└────────────────┼─────────┼─────────────────────────────────────────┘
                 │         │
    ┌────────────┼─────────┼──────────────────────────────────┐
    │            ▼         ▼          Next.js 16 Server       │
    │  ┌─────────────────────────────┐                        │
    │  │    Server Actions           │                        │
    │  │  (createProject,            │                        │
    │  │   startGeneration, ...)     │                        │
    │  └───────────┬─────────────────┘                        │
    │              │                                          │
    │  ┌───────────▼─────────────────┐                        │
    │  │    Director (director.ts)    │                        │
    │  │  多阶段管线控制器 · 自动恢复 │                        │
    │  └───────────┬─────────────────┘                        │
    │              │                                          │
    │  ┌───────────▼─────────────────┐                        │
    │  │    LangGraph State Machine  │                        │
    │  │   ScriptParser → Continuity │                        │
    │  │   → DispatchRenderQueue     │                        │
    │  └───────────┬─────────────────┘                        │
    │              │                                          │
    └──────────────┼──────────────────────────────────────────┘
                   │ dispatch flow tree
    ┌──────────────▼──────────────────────────────────────────┐
    │              BullMQ / Redis                             │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
    │  │ Parse    │ │ Shot     │ │ Compose  │ │ Asset    │  │
    │  │ Worker   │ │ Worker   │ │ Worker   │ │ Worker   │  │
    │  │          │ │ (image + │ │ (FFmpeg) │ │ (Poll    │  │
    │  │          │ │  video)  │ │          │ │  Asset)  │  │
    │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
    └────────────────────────────────────────────────────────┘
```

### 5.2 流水线阶段

```
Phase 1: ASSET_EXTRACTION ──→ Phase 2: PARSING
    ↓                               ↓
    LLM 提取角色/场景/道具      解析为结构化 Scene + Character
    ↓                               ↓
Phase 3: ASSET_GENERATION ──→ Phase 4: SCRIPT_NORMALIZATION
    ↓                               ↓
    生成 MRI 参考图             场次规范化 · 单集剧本生成
    ↓                               ↓
Phase 5: STORYBOARDING ──────→ Phase 6: SHOT_RENDER
    ↓                               ↓
    写入 imagePrompt +           Part 1 制片板静帧
    videoPrompt 到每镜           Part 2 Seedance 视频
                                    ↓
                               Phase 7: COMPOSING
                                    ↓
                               FFmpeg 按集合成 MP4
```

### 5.3 数据流

```
原始文本 (rawScript)
    │
    ▼
LLM 结构化解析
    │
    ├──→ Character[] (角色定义 + visualPrompt)
    ├──→ Scene[] (场次定义 + 剧本文本)
    │         │
    │         ▼
    │    ECP 分镜引擎 → Shot[].{imagePrompt, videoPrompt}
    │         │
    │         ▼
    │    BullMQ Shot Worker (并发池, 默认 5)
    │         │
    │         ├──→ Tencent OG Image 2 → Shot.imageUrl
    │         └──→ Seedance 2.0 → Shot.videoUrl (含原生音频)
    │
    ▼
BullMQ Compose Worker (FFmpeg)
    │
    ▼
Project.episodeFinals (按集 MP4)
```

---

## 6. 数据库模型（Prisma Schema）

共 8 个数据模型：

| 模型 | 核心字段 | 用途 |
|------|----------|------|
| **User** | id, email, name, avatarUrl, plan, credits | 用户 |
| **Series** | id, title, language, mode (SERIAL/FULL), userId | 剧集系列 |
| **SeriesCharacter** | id, seriesId, name, description, refImageUrl, volcengineAssetId | 系列共享角色池 |
| **Project** | id, title, episodeCount, status, pipelineStage, rawScript, modelConfig, finalVideoUrl, episodeFinals | 项目/单集 |
| **Scene** | id, projectId, episodeNumber, order, location, scriptText, duration | 场次 |
| **Character** | id, projectId, name, visualPrompt, refImageUrl, volcengineAssetId | 角色 |
| **Prop** | id, sceneId, name, refImageUrl | 道具 |
| **Shot** | id, sceneId, order, type, imagePrompt, videoPrompt, imageUrl, videoUrl, status, cost | 分镜 |
| **ShotCharacter** | shotId + characterId (join) | 分镜-角色关联 |
| **Job** | id (BullMQ jobId), projectId, queueName, status, payload, result | 任务追踪 |

---

## 7. 外部依赖与集成

| 服务 | 集成方式 | 用途 | 安全要求 |
|------|----------|------|----------|
| 火山引擎 ARK | REST API (ark.cn-beijing.volces.com) | 文本生成 + 视频生成 | API Key |
| 火山引擎资材库 | HMAC-SHA256 签名 | 角色资产注入 | AK/SK |
| 腾讯云 VOD | TC3-HMAC-SHA256 签名 | OG Image 2 图像生成 | SecretId + SecretKey |
| 阿里云 DashScope | REST API | 万相图像生成（回退） | API Key |
| ElevenLabs | npm package | TTS 配音 | API Key |
| FFmpeg | fluent-ffmpeg + 二进制 | 视频合成 | 本地安装 |
| PostgreSQL | Prisma ORM + pg | 持久化 | 连接密码 |
| Redis | ioredis | 队列 + 缓存 | 连接密码 |

---

## 8. 交付物

| 交付物 | 说明 | 形式 |
|--------|------|------|
| **完整源码** | 全部 TypeScript / React 源码 | GitHub 仓库 |
| **Docker 部署方案** | Dockerfile + docker-compose.yml + deploy.sh | 容器化部署 |
| **数据库 Schema** | Prisma schema + 迁移 | Prisma 文件 |
| **AI Agent 配置** | LangGraph 图 + BullMQ Worker | 源码 |
| **Prompt 模板** | 中英双语制表板/视频提示词 | Markdown 文件 |
| **API 端点** | 健康检查、SSE 事件、队列统计 | Route Handler |
| **用户界面** | 项目管理 / 编辑器 / 系列 / 资产页 | React 组件 |
| **部署文档** | nginx 配置、环境变量说明、本地运行指南 | README / .env.example |

---

## 9. 里程碑与排期（建议）

| 阶段 | 内容 | 状态 |
|------|------|------|
| **M0 — 基础架构** | Next.js 框架搭建、Prisma Schema、Docker 化部署 | ✅ 完成 |
| **M1 — 核心 AI 集成** | 火山引擎文本/视频、腾讯/阿里图像、ElevenLabs TTS | ✅ 完成 |
| **M2 — 剧本解析管线** | LangGraph 编排、剧本解析 Agent、场次规范化 | ✅ 完成 |
| **M3 — 分镜引擎（ECP）** | 双提示词生成、Part 1 制片板、Part 2 Seedance | ✅ 完成 |
| **M4 — 队列与 Worker** | BullMQ 多 Worker 并发、Shot 生成、FFmpeg 合成 | ✅ 完成 |
| **M5 — 前端界面** | 项目 CRUD、编辑器、进度页、资产库、系列管理 | ✅ 完成 |
| **M6 — 资产管理体系** | MRI 参考图生成、Volcengine 注入、资产审核流程 | ✅ 完成 |
| **M7 — 打磨与测试** | 错误处理、重试机制、类型检查、端到端验证 | 🔄 进行中 |
| **M8 — 生产部署** | nginx SSL、性能优化、监控告警、容量规划 | ⏳ 待开始 |

---

## 10. 假设与约束

### 假设

1. **API 可用性**：假设火山引擎、腾讯云、阿里云等 AI 服务在其 SLA 范围内稳定可用。
2. **网络环境**：服务器需具备对中国云服务商 API 的低延迟访问（建议中国大陆节点部署）。
3. **GPU 推理**：Seedance 视频推理由火山引擎服务器端执行，本地无 GPU 需求。
4. **用户内容授权**：用户上传的剧本/小说默认拥有合法版权或授权。
5. **音轨自动生成**：Seedance 2.0 Fast 支持 `generate_audio: true` 且质量可接受。

### 约束

1. **模型锁定**：视频生成引擎当前锁定为 Seedance 2.0 Fast（代码硬编码），不支持运行时切换。
2. **单用户**：系统无用户认证与权限隔离，仅适合单用户/演示场景。
3. **最大并发送**：Shot Worker 默认并发池 5，Compose Worker 并发池 2，受 Redis + API 配额限制。
4. **视频时长**：每镜固定约 15 秒，每集镜头数取决于剧本长度。
5. **图片地理限制**：Tencent OG Image 2 需腾讯云账号开通 VOD 服务。
6. **Node 版本**：要求 Node.js 22+ + pnpm 10。

---

## 11. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| AI API 限频/降级 | 管线卡住 | 中 | 自动重试 + 指数退避 + 回退模型 |
| Seedance 隐私过滤 | 视频生成失败 | 中 | 自动降级（去参考图重试） |
| 角色一致性漂移 | 同角色不同镜外观不一致 | 中 | MRI 资产注入 + Volcengine 资材库 |
| 腾讯 OG 生成慢 | 单图 > 8 分钟 | 高 | 200 次轮询 + Wanxiang 回退 |
| FFmpeg 编码失败 | 最终合成失败 | 低 | 分段重试 + 错误日志 |
| 火山引擎 API 密钥暴露 | 安全风险 | 低 | 仅服务端使用，SSR 隔离 |

---

## 12. 开发指南

### 本地快速启动

```bash
# 安装依赖
pnpm install

# 启动基础设施（PostgreSQL + Redis）
docker compose up -d db redis

# 同步数据库
pnpm prisma db push

# 启动 Next.js 开发服务器
pnpm dev

# 启动 BullMQ Worker（另一个终端）
pnpm dev:worker
```

### 类型检查

```bash
pnpm typecheck
```

### 代码风格

- TypeScript strict 模式
- ES2023 目标
- `@/` 路径别名映射到 `./src/*`
- 修改 Prompt 模板时优先改 `prompts/part*.md`，勿硬编码在 TS 中
- 所有环境变量通过 `src/lib/env.ts`（Zod 校验）读取

---

## 13. 相关文档索引

| 文档 | 位置 | 用途 |
|------|------|------|
| 项目简介 | `PROJECT_BRIEF.md` | AI 编辑器结构化指令 |
| 演示 PPT | `presentation.md` | Marp 格式演示文稿 |
| 环境变量 | `.env.example` | 全部环境变量模板 |
| Docker 部署 | `Dockerfile` + `docker-compose.yml` | 生产容器化方案 |
| API 提示词 | `prompts/part1-storyboard.{zh,en}.md` | 制片板静帧 Prompt |
| API 提示词 | `prompts/part2-seedance.{zh,en}.md` | Seedance 视频 Prompt |
| 数据库 Schema | `prisma/schema.prisma` | 完整 Prisma 模型定义 |

---

*本文档将随项目迭代持续更新。*
