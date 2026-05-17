---
name: manga-workflow
description: 将小说/剧本转换为短视频的端到端工作流编排器。当用户提到做视频、创建项目、继续项目、查看进度时使用。触发场景包括："帮我把小说做成视频"、"开个新项目"、"继续"、"下一步"、"看看项目进度"、"从头开始"、"自动跑完流程"等。不要用于单个资产生成。
---

# 视频工作流编排（Drama 短剧模式）

你（主 agent）是编排中枢。你**不直接**处理小说原文或生成剧本，而是：
1. 检测项目状态 → 2. 决定下一阶段 → 3. dispatch 合适的 subagent → 4. 展示结果 → 5. 获取用户确认 → 6. 循环

**核心约束**：
- 小说原文**永远不加载到主 agent context**，由 subagent 自行读取
- 每次 dispatch 只传**文件路径和关键参数**，不传大块内容
- 每个 subagent 完成一个聚焦任务就返回，主 agent 负责阶段间衔接

---

## 阶段 0：项目设置

### 新项目

1. 用户创建项目后，session 绑定到项目根目录
2. 请用户将小说文本上传（rawScript 写入 Project）
3. 确认 content_mode 为 `drama`（短剧模式）

### 现有项目

1. 通过 Prisma 读取 Project + Scene + Character + Shot 状态
2. 从上次未完成的阶段继续

---

## 状态检测

按顺序检查，遇到第一个缺失项即确定当前阶段：

1. `Project.pipelineStage === 'IDLE'` 且 `Scene.count === 0`？ → **阶段 1**（全局分析）
2. `Character` 表为空（或全部 character 缺少 `refImageUrl`）？ → **阶段 2**（资产提取）
3. 有 `Scene` 但没有 `Shot`（StoryboardSchema）？ → **阶段 3**（分镜生成）
4. `Shot` 缺少 `imageUrl`（关键帧未生成）？ → **阶段 4**（关键帧生成）
5. `Shot` 缺少 `videoUrl`（视频未生成）？ → **阶段 5**（视频生成）
6. 有 `episodeFinals` 字段为空？ → **阶段 6**（合成）
7. 全部完成 → 工作流结束

---

## 阶段间确认协议

每个 subagent 返回后，主 agent 执行：
1. **展示摘要**：将 subagent 返回的摘要展示给用户
2. **获取确认**：提供选项：
   - **继续下一阶段**（推荐）
   - **重做此阶段**（附加修改要求后重新 dispatch）
   - **跳过此阶段**
3. **根据用户选择行动**

---

## 阶段 1：全局角色/场景/道具提取（analyze-assets）

**触发**：`Scene.count === 0`

**dispatch `analyze-assets` subagent**：
```
项目名称：{project_title}
分析范围：整部小说
已有角色：无
已有场景：无

请分析小说原文，提取角色 / 场景 / 道具信息，写入数据库，返回摘要。
```

---

## 阶段 2：资产设计（character / scene / prop 三类并行）

**触发**：有角色缺少 refImageUrl

**dispatch asset 生成**：
```
任务类型：character
项目ID：{projectId}
待生成项：{缺失角色名列表}
```

---

## 阶段 3：剧本规范化与分镜生成（normalize-drama-script → create-episode-script → generate-storyboard）

**触发**：有 Scene 但无 Shot

**Step 1 - dispatch `normalize-drama-script` subagent**：
将小说场次改编为结构化分镜场景表

**Step 2 - dispatch `create-episode-script` subagent**：
将规范化场景表生成为 JSON 剧本

**Step 3 - dispatch storyboard 生成**：
为每场生成结构化 imagePrompt/videoPrompt

---

## 阶段 4：关键帧生成

**触发**：有 Shot 缺少 imageUrl

调用 image service 为每个 shot 生成 12 宫格分镜图。

---

## 阶段 5：视频生成

**触发**：有 Shot 缺少 videoUrl

以分镜图为首帧参考 + MRI 参考图，调用 Seedance 生成视频。

---

## 阶段 6：合成

**触发**：缺少 episodeFinals

FFmpeg 按镜头序合成为每集成片。

---

## 灵活入口

工作流不强制从头开始。根据状态检测结果，自动从正确的阶段开始：

- "分析小说角色" → 只执行阶段 1
- "继续" → 状态检测找到第一个缺失项
- 指定具体阶段（如"生成分镜图"）→ 直接跳到该阶段
