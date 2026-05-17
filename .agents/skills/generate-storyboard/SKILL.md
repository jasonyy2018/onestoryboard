---
name: generate-storyboard
description: 为剧本场景生成结构化的分镜提示词（imagePrompt / videoPrompt）。每个场景生成一组连续的 15 秒镜头行，包含镜头语言、角色连续性、场景连续性等标记。
---

# 生成分镜提示词

通过文本模型为每个场景生成结构化的 ECP 分镜提示词表。

## 工具调用

调用 `generateStructured` 使用 DeepSeek V3 Flash 生成 `StoryboardSchema`。

## 工作流程

1. **加载场景和角色** — 确认所有角色都有 refImageUrl（角色参考图）
2. **生成分镜提示词** — 为每场生成多行 shot（每行 15s）
3. **写入数据库** — 将 shot 写入 Shot 表

## 角色一致性机制

- **character_sheet**：场景中出场角色的设计图，保持外貌一致
- **scene reference**：场景参考图
- **上一张分镜图**：相邻片段默认引用，提升画面连续性
- 当 `segment_break=true` 时，跳过上一张分镜图参考

## Prompt 构建

从剧本数据读取以下字段构建 prompt：

```
场景 [sceneId] 的分镜：

- 画面描述：[visual.description]
- 镜头构图：[visual.shotType]
- 镜头运动：[visual.cameraMovement]
- 光线条件：[visual.lighting]
- 画面氛围：[visual.mood]
- 角色：[charactersInScene]
- 动作：[action]

风格要求：真人写实电影级，角色必须与角色参考图完全一致。
```

## 输出

- `imagePrompt`：12 格分镜表图提示词（含十段 ECP 标签）
- `videoPrompt`：15 秒运镜提示词（含 5 段时间码标签）
- 每镜的 type/cameraMove/charactersInShot
