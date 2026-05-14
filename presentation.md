---
marp: true
theme: default
paginate: true
backgroundColor: #121212
color: #ffffff
style: |
  section {
    font-family: 'Inter', sans-serif;
    justify-content: start;
    padding-top: 50px;
  }
  h1 { color: #bb86fc; }
  h2 { color: #03dac6; }
  .screenshot {
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    max-height: 400px;
  }
---

# OneStoryboard
### AI 全自动短剧生成平台
**项目演示报告**

---

# 1. 项目愿景与目标
- **核心定位**：全栈 AI Agent 流水线，实现从剧本到短剧视频的自动化生产。
- **目标用户**：内容创作者、短剧制片人、AI 影视探索者。
- **关键优势**：
  - 结构化项目管理。
  - 高度的一致性（MRI 资产锚点）。
  - 精准的分镜控制（约 15 秒/镜）。

---

# 2. 产品界面预览 - 新建项目
![screenshot](C:/Users/jason/.gemini/antigravity/brain/b9448ef4-9d3d-4312-8594-16dbb239901a/new_project_page_1778769602286.png)
*支持导入剧本或小说，一键配置语言（中/英）与集数。*

---

# 3. 核心功能与工作流
1. **剧本解析 (Script Parsing)**：
   - 使用 **Doubao Seed 2.0** 将长文本解析为结构化场次。
2. **一致性资产 (MRI Assets)**：
   - 自动化生成角色、场景、道具的参考图，作为视觉一致性锚点。
3. **分镜生成 (Storyboard)**：
   - 双提示词引擎（EL.CINE）：同时生成制片板图 (Image) 与 视频 (Video) 提示词。
4. **引擎生成 (AI Generation)**：
   - **Tencent OG Image 2** (生图) + **Seedance 2.0** (图生视频 + 原生音轨)。

---

# 4. 技术栈架构 (Tech Stack)
- **前端框架**：Next.js 16 (App Router) + TypeScript
- **UI 框架**：Tailwind CSS 4 + Radix UI
- **后端服务**：
  - **数据库**：PostgreSQL (Prisma ORM)
  - **异步队列**：Redis + BullMQ (多级 Worker 协同)
  - **Agent 编排**：LangGraph (表达复杂状态机与同步阶段)
- **媒体处理**：FFmpeg (多段视频拼接与 AAC 音频编码)

---

# 5. AI Agent 拓扑结构
- **ScriptParserAgent**：负责剧本结构化与 EL.CINE 提示词编写。
- **StoryboardAgent**：控制制片板静帧生成与视觉锁定。
- **VideoGeneratorAgent**：驱动 Seedance 进行视频与音轨生成。
- **ComposerAgent**：负责最终集成的视频剪辑与导出。

---

# 6. 未来展望 (Roadmap)
- **ContinuityChecker**：引入视觉一致性校验 Agent，优化长视频连贯性。
- **多模态导演控制**：支持通过自然语言对具体镜头进行更细粒度的调整。
- **更丰富的模板系统**：提供更多风格化的视觉模板与音效预设。

---

# 谢谢观赏
**OneStoryboard**
*Empowering Creativity with AI*
