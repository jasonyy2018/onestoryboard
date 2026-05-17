---
name: create-episode-script
description: 单集 JSON 剧本生成。接收规范化场景表，调用文本模型生成最终的 JSON 剧本（含每个分镜的 visual description、image_prompt、video_prompt）。
---

# JSON 剧本生成

## 任务定义

*前置条件*：Character/Scene 表已写入，Scenes 已有规范化 scriptText。

## 核心原则

1. **调用文本模型**生成最终的 JSON 剧本
2. **验证输出**：确认 JSON 格式正确，所有字段完整
3. **完成即返回**：独立完成全部工作后返回，不等待用户确认

## 工作流程

### Step 1: 确认前置条件

通过 Prisma 确认：
- Character 表不为空
- Scene 表不为空（有规范化后的 scriptText）

### Step 2: 生成 JSON 剧本

调用文本模型（`generateStructured` with `DramaEpisodeScript` schema）：

输入：
- 每场的规范化描述
- 该场涉及的角色列表
- 该场涉及的道具列表
- 集号

输出 schema：
```typescript
{
  episode: number;
  scenes: [{
    sceneId: string;
    visual: { description, shotType, cameraMovement, lighting, mood };
    dialogue?: { character, line }[];
    action?: string;
    charactersInScene: string[];
    durationSeconds: number;
  }];
}
```

### Step 3: 返回摘要

```
## JSON 剧本生成完成

**项目**: {title} **第 N 集**

| 统计项 | 数值 |
|--------|------|
| 总场景数 | XX 个 |
| 总时长 | X 分 X 秒 |

✅ 数据验证通过

下一步：进入分镜生成阶段。
```
