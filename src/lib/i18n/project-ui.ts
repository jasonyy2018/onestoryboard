/**
 * 项目工作区文案：严格随 `project.language`（zh / en）切换，与侧边栏全局语言无关。
 */
export type ProjectLocale = "zh" | "en";

export function projectLocale(lang: string | null | undefined): ProjectLocale {
  return lang === "en" ? "en" : "zh";
}

export type ProjectUi = {
  editor: {
    breadcrumbProjects: string;
    episodes: string;
    saved: string;
    autoSaveOn: string;
    reparseScript: string;
    /** 保留场次/MRI，仅删除分镜行并重跑 ECP LLM */
    regenerateStructuredPrompts: string;
    regenerateStructuredPromptsTitle: string;
    regenerateStructuredPromptsNeedScenes: string;
    regenerateStructuredPromptsWaitGenerating: string;
    generateVideo: string;
    scriptEditorTitle: string;
    scenesCount: string;
    storyboardTitle: string;
    shotsCount: string;
    openStoryboard: string;
  };
  progress: {
    backEditor: string;
    started: string;
    shotsReady: string;
    storyboardLink: string;
    resumePipeline: string;
    pausePipeline: string;
    cancel: string;
    storyboardFoldTitle: string;
    storyboardFoldHint: string;
    /** 「双提示词 → 制片板图 → Seedance 视频」三栏简视 */
    flowTitle: string;
    /** 第一栏标题：两条结构化提示词 */
    flowTwoPromptsTitle: string;
    flowTwoPromptsHint: string;
    flowPanelImageTitle: string;
    flowPanelImageHint: string;
    flowClipTitle: string;
    flowClipHint: string;
    flowLabelImagePrompt: string;
    flowLabelVideoPrompt: string;
    flowPending: string;
    flowActive: string;
    flowDone: string;
    flowNoShots: string;
    /** 与代码一致的制片链路（含 MRI、双提示词、制片板为首张参考进 Seedance） */
    flowCaption: string;
  };
  pipeline: {
    title: string;
    done: string;
    running: string;
    pending: string;
    stages: { label: string; hint: string }[];
  };
  activityLog: {
    header: string;
    live: string;
    waiting: string;
    agents: { Director: string; Parser: string; AssetGen: string; Composer: string };
    snapshotPrefix: string;
    completedSuffix: string;
    failedPrefix: string;
  };
  shotGrid: {
    title: string;
    subtitle: string;
    active: string;
    done: string;
    queued: string;
    cell: Record<string, string>;
    colDualPrompt: string;
    colPanel: string;
    colClip: string;
  };
  storyboardPage: {
    backEditor: string;
    progress: string;
    result: string;
  };
  storyboardRich: {
    titleSuffix: string;
    subtitleTemplate: string;
    searchPlaceholder: string;
    expandAll: string;
    collapseAll: string;
    emptyNoData: string;
    emptyFilter: string;
    epScene: string;
    shotNo: string;
    imagePrompt: string;
    videoPrompt: string;
    /** 入库主字段 shot.prompt，常与画面提示同源 */
    rowPrimaryPrompt: string;
    copy: string;
    videoTitle: string;
    videoGenerating: string;
    videoNone: string;
    keyframe: string;
    castPrefix: string;
  };
  result: {
    backProjects: string;
    notReadyTitle: string;
    notReadyStatus: string;
    viewProgress: string;
    completed: string;
    generatedIn: string;
    shots: string;
    runtime: string;
    storyboard: string;
    share: string;
    rerender: string;
    downloadMp4: string;
    finalMissing: string;
    timeline: string;
    timelineHint: string;
    shotN: string;
    projectInfo: string;
    export: string;
    duration: string;
    resolution: string;
    frameRate: string;
    fileSize: string;
    cost: string;
    exportMp41080: string;
    exportMp41080Hint: string;
    exportMp44k: string;
    exportMp44kHint: string;
    exportGif: string;
    exportGifHint: string;
    exportBundle: string;
    exportBundleHint: string;
    episodeExportsTitle: string;
    episodeVideoTemplate: string;
    multiEpisodeHint: string;
  };
  modelSettings: {
    modelsPrefix: string;
    defaultModel: string;
    dialogTitle: string;
    labelText: string;
    labelImage: string;
    labelStoryboardImage: string;
    storyboardImageHelp: string;
    labelVideo: string;
    labelAspect: string;
    labelResolution: string;
    labelLanguage: string;
    labelEpisodes: string;
    episodesHelp: string;
    cancel: string;
    saving: string;
    save: string;
    selectPlaceholder: string;
    langZh: string;
    langEn: string;
  };
  storyboardPanel: {
    emptyTitle: string;
    emptyHint: string;
    notGenerated: string;
    pending: string;
    allGenerated: string;
    generating: string;
    generatingShort: string;
    queued: string;
  };
  assets: {
    centerTitle: string;
    tabCharacters: string;
    tabScenes: string;
    tabProps: string;
    confirmBtn: string;
    confirmDesc: string;
    confirming: string;
    confirmed: string;
  };
  characterPanel: {
    title: string;
    castCount: string;
    empty: string;
    noDesc: string;
    tip: string;
    regenTitle: string;
    customImgTitle: string;
    statusActive: string;
    statusAuditing: string;
    statusFailed: string;
  };
  scenePanel: {
    empty: string;
    noRef: string;
    regenerate: string;
    upload: string;
    statusActive: string;
    statusAuditing: string;
    statusFailed: string;
  };
  propPanel: {
    empty: string;
    noRef: string;
    upload: string;
    regen: string;
    regenTitle: string;
  };
  projectStatus: Record<string, string>;
  shotStatus: Record<string, string>;
  shotType: Record<string, string>;
};

const ZH_UI: ProjectUi = {
  editor: {
    breadcrumbProjects: "项目",
    episodes: "集",
    saved: "已保存",
    autoSaveOn: "输入后自动保存",
    reparseScript: "重新解析剧本",
    regenerateStructuredPrompts: "仅重生双提示词（ECP）",
    regenerateStructuredPromptsTitle:
      "删除当前所有分镜行与成片记录，按现有场次剧本与角色设定重新生成结构化 imagePrompt / videoPrompt；不重新解析全文、不重画 MRI。已排队出片任务会被取消。",
    regenerateStructuredPromptsNeedScenes: "需先完成一次「生成视频」解析流程，使项目中存在至少一个场次后再使用。",
    regenerateStructuredPromptsWaitGenerating: "当前流水线正在生成中，请等待结束或先到进度页暂停后再试。",
    generateVideo: "生成视频",
    scriptEditorTitle: "剧本编辑器",
    scenesCount: "个场景",
    storyboardTitle: "双提示词 · 制片板与出片",
    shotsCount: "个镜头",
    openStoryboard: "查看分镜表图与约 15s 镜头",
  },
  progress: {
    backEditor: "编辑器",
    started: "开始于",
    shotsReady: "个镜头就绪",
    storyboardLink: "分镜表（双提示词与成片）",
    resumePipeline: "继续流水线",
    pausePipeline: "暂停流水线",
    cancel: "取消",
    storyboardFoldTitle: "每镜：双提示词 · 制片板 · 约 15s",
    storyboardFoldHint: "镜 · 点击展开",
    flowTitle: "标准流程（与引擎一致）",
    flowTwoPromptsTitle: "双提示词",
    flowTwoPromptsHint: "① 制片板生图 ② Seedance 图生视频（入库）",
    flowPanelImageTitle: "制片板图",
    flowPanelImageHint: "生图模型 + Part1 模板",
    flowClipTitle: "镜头视频",
    flowClipHint: "Seedance 2.0 · 首张参考 = 制片板 + MRI",
    flowLabelImagePrompt: "生图",
    flowLabelVideoPrompt: "视频",
    flowPending: "待开始",
    flowActive: "进行中",
    flowDone: "已完成",
    flowNoShots: "尚无镜头数据",
    flowCaption:
      "导入小说或剧本 → 按集/场解析 → 角色·场景·道具 MRI 参考图 → 每镜写入两条提示词（imagePrompt：多格真人制片板；videoPrompt：Seedance 叙事与运镜）→ 用①生成制片板静帧 → 用②以「制片板为首张参考图 + MRI」生成约 15s 视频（原生音频）→ FFmpeg 按集拼接成片。",
  },
  pipeline: {
    title: "流水线：导入 → 分集/场 → 资产 → 双提示词 → 制片板 → Seedance → 合成",
    done: "已完成",
    running: "进行中…",
    pending: "等待",
    stages: [
      { label: "导入与分集", hint: "小说或剧本 → 标准场次结构（集/场）" },
      { label: "MRI 资产", hint: "角色·场景·道具参考图（一致性锚点）" },
      { label: "双提示词", hint: "每镜 imagePrompt + videoPrompt（ECP 写入）" },
      { label: "制片与成片", hint: "制片板图（生图）→ Seedance（首参=板图+MRI）→ 按集拼接" },
    ],
  },
  activityLog: {
    header: "智能体活动",
    live: "实时",
    waiting: "等待事件…",
    agents: {
      Director: "导演",
      Parser: "解析",
      AssetGen: "出图 / 出片",
      Composer: "合成",
    },
    snapshotPrefix: "流水线阶段",
    completedSuffix: "已完成",
    failedPrefix: "失败",
  },
  shotGrid: {
    title: "并行任务 · BullMQ",
    subtitle: "镜头流水线",
    active: "进行中",
    done: "完成",
    queued: "排队",
    cell: {
      READY: "板图+15s",
      GENERATING_IMAGE: "生图中…",
      GENERATING_VIDEO: "视频中…",
      IMAGE_READY: "图就绪",
      FAILED: "失败",
      PENDING: "排队",
    },
    colDualPrompt: "双提示词（①生图 ②Seedance）",
    colPanel: "制片板图",
    colClip: "Seedance ~15s",
  },
  storyboardPage: {
    backEditor: "编辑器",
    progress: "进度",
    result: "成片",
  },
  storyboardRich: {
    titleSuffix: "分镜表",
    subtitleTemplate:
      "共 {count} 条镜头。流程：导入 → 分集/场 → MRI → 双提示词（生图 / Seedance）→ 制片板静帧 → 以制片板为首张参考 + MRI 走 Seedance 2.0（约 15s，含原生音频）→ 按集合成。",
    searchPlaceholder: "搜索文案、场次、角色…",
    expandAll: "全部展开",
    collapseAll: "全部折叠",
    emptyNoData: "尚无分镜。请先保存剧本并点击「生成视频」，完成解析、资产与双提示词写入。",
    emptyFilter: "没有符合搜索条件的镜头。",
    epScene: "场",
    shotNo: "镜号",
    imagePrompt: "① 制片板生图提示词（imagePrompt）",
    videoPrompt: "② Seedance 视频提示词（videoPrompt）",
    rowPrimaryPrompt: "行主字段（prompt，常与①对齐）",
    copy: "复制",
    videoTitle: "约 15s 镜头",
    videoGenerating: "视频生成中…",
    videoNone: "尚无成片",
    keyframe: "制片板成图",
    castPrefix: "出镜",
  },
  result: {
    backProjects: "项目列表",
    notReadyTitle: "尚未就绪",
    notReadyStatus: "状态",
    viewProgress: "查看进度",
    completed: "已完成",
    generatedIn: "生成耗时",
    shots: "个镜头",
    runtime: "成片时长",
    storyboard: "ECP 分镜",
    share: "分享",
    rerender: "重新渲染",
    downloadMp4: "下载 MP4",
    finalMissing: "成片地址缺失",
    timeline: "时间线",
    timelineHint: "拖拽镜头排序 · 点击可重新渲染",
    shotN: "镜头",
    projectInfo: "项目信息",
    export: "导出",
    duration: "时长",
    resolution: "分辨率",
    frameRate: "帧率",
    fileSize: "文件大小",
    cost: "成本",
    exportMp41080: "MP4 高清 1080p",
    exportMp41080Hint: "原画",
    exportMp44k: "MP4 超清 4K",
    exportMp44kHint: "+50 点",
    exportGif: "GIF 预览",
    exportGifHint: "—",
    exportBundle: "项目打包",
    exportBundleHint: "分镜+成片",
    episodeExportsTitle: "分集 / 成章成片",
    episodeVideoTemplate: "第 {n} 集",
    multiEpisodeHint: "多集项目：每集一条成片，可分别下载。",
  },
  modelSettings: {
    modelsPrefix: "模型",
    defaultModel: "默认",
    dialogTitle: "模型配置",
    labelText: "剧本解析（文本）",
    labelImage: "场景可视化（图像）",
    labelStoryboardImage: "分镜表图（首帧）",
    storyboardImageHelp:
      "可单独指定；留空则与「场景可视化」的 imageModel 一致。产品出图统一为腾讯混元生图 OG（Image 2）；历史若保存过万相，已自动改为 OG。默认生成多格真人制片板静帧；该图作为本条约 15 秒视频生成的首张参考图，其后为角色/场景 MRI 锚点（参考图合计上限 9 张）。",
    labelVideo: "动态影像（视频）",
    labelAspect: "画幅比例",
    labelResolution: "目标分辨率",
    labelLanguage: "生成语言",
    labelEpisodes: "目标集数",
    episodesHelp: "为本项目生成的独立集数。",
    cancel: "取消",
    saving: "保存中…",
    save: "保存更改",
    selectPlaceholder: "请选择模型…",
    langZh: "中文",
    langEn: "英文",
  },
  storyboardPanel: {
    emptyTitle: "尚无分镜",
    emptyHint:
      "顺序：导入 → 分集/场 → MRI → 双提示词 → 制片板图 → Seedance（首参=板图+MRI，约 15s）→ 按集合成。点击「生成视频」启动。",
    notGenerated: "尚未生成分镜",
    pending: "等待中",
    allGenerated: "已全部生成",
    generating: "生成中",
    generatingShort: "生成中…",
    queued: "排队",
  },
  assets: {
    centerTitle: "资产中心",
    tabCharacters: "角色库",
    tabScenes: "场景库",
    tabProps: "道具库",
    confirmBtn: "确认资产完成，继续生成",
    confirmDesc: "确认后进入双提示词写入与后续制片、出片队列",
    confirming: "提交中…",
    confirmed: "已确认，继续中",
  },
  characterPanel: {
    title: "角色",
    castCount: "位角色",
    empty: "尚未从剧本中提取角色。",
    noDesc: "暂无描述。",
    tip: "提示：设置角色参考图可在各镜头中保持外观一致。",
    regenTitle: "用 AI 重新生成",
    customImgTitle: "上传自定义图",
    statusActive: "已激活",
    statusAuditing: "审核中",
    statusFailed: "失败",
  },
  scenePanel: {
    empty: "暂无场景。",
    noRef: "暂无参考图",
    regenerate: "重新生成",
    upload: "上传",
    statusActive: "已激活",
    statusAuditing: "审核中",
    statusFailed: "失败",
  },
  propPanel: {
    empty: "剧本中未检测到道具。",
    noRef: "无图",
    upload: "上传",
    regen: "重新生成",
    regenTitle: "用 AI 重新生成道具参考图",
  },
  projectStatus: {
    DRAFT: "草稿",
    GENERATING: "生成中",
    COMPLETED: "已完成",
    FAILED: "失败",
    PAUSED: "已暂停",
    CANCELLED: "已取消",
  },
  shotStatus: {
    PENDING: "等待中",
    GENERATING_IMAGE: "生图中",
    GENERATING_VIDEO: "视频中",
    IMAGE_READY: "图就绪",
    READY: "就绪",
    FAILED: "失败",
  },
  shotType: {
    WIDE: "全景",
    MEDIUM: "中景",
    CLOSE_UP: "特写",
    OTS: "过肩",
    INSERT: "插入",
    ESTABLISHING: "建立",
    POV: "主观",
  },
};

const EN_UI: ProjectUi = {
  editor: {
    breadcrumbProjects: "Projects",
    episodes: "Episodes",
    saved: "Saved",
    autoSaveOn: "Auto-saves after edits",
    reparseScript: "Re-parse script",
    regenerateStructuredPrompts: "Regenerate two prompts (ECP) only",
    regenerateStructuredPromptsTitle:
      "Deletes all shot rows and episode masters, then re-runs the ECP model on your current scenes and cast MRI text to rebuild structured imagePrompt / videoPrompt. Does not re-parse the full script or regenerate MRI plates. Cancels queued render jobs.",
    regenerateStructuredPromptsNeedScenes:
      "Run “Generate video” once so the project has at least one parsed scene before using this.",
    regenerateStructuredPromptsWaitGenerating:
      "A generation pipeline is running; wait for it to finish or pause it from the progress page first.",
    generateVideo: "Generate video",
    scriptEditorTitle: "Script editor",
    scenesCount: "scenes",
    storyboardTitle: "Two prompts · panels & render",
    shotsCount: "shots",
    openStoryboard: "View panel images & ~15s clips",
  },
  progress: {
    backEditor: "Editor",
    started: "Started",
    shotsReady: "shots ready",
    storyboardLink: "Storyboard (prompts & clips)",
    resumePipeline: "Resume pipeline",
    pausePipeline: "Pause pipeline",
    cancel: "Cancel",
    storyboardFoldTitle: "Per shot: two prompts · panel · ~15s",
    storyboardFoldHint: "shots · tap to expand",
    flowTitle: "Pipeline (matches the engine)",
    flowTwoPromptsTitle: "Two prompts",
    flowTwoPromptsHint: "① Panel image ② Seedance I2V (stored)",
    flowPanelImageTitle: "Panel sheet",
    flowPanelImageHint: "Image model + Part 1 template",
    flowClipTitle: "Clip video",
    flowClipHint: "Seedance 2.0 · first ref = panel + MRI",
    flowLabelImagePrompt: "Image",
    flowLabelVideoPrompt: "Video",
    flowPending: "Pending",
    flowActive: "Running",
    flowDone: "Done",
    flowNoShots: "No shots yet",
    flowCaption:
      "Import novel or script → split by episode/scene → MRI references → per-shot imagePrompt (multi-panel sheet) + videoPrompt (Seedance narrative/motion) → render panel still from ① → ② uses panel as first reference + MRI for ~15s clip (native audio) → FFmpeg stitch per episode.",
  },
  pipeline: {
    title: "Pipeline: import → split → assets → two prompts → panel → Seedance → stitch",
    done: "Done",
    running: "Running…",
    pending: "Pending",
    stages: [
      { label: "Import & split", hint: "Novel or script → episode/scene structure" },
      { label: "MRI assets", hint: "Cast / location / prop reference plates" },
      { label: "Two prompts", hint: "Per-shot imagePrompt + videoPrompt (ECP)" },
      { label: "Render & master", hint: "Panel image → Seedance (panel first + MRI) → stitch" },
    ],
  },
  activityLog: {
    header: "Agent activity",
    live: "LIVE",
    waiting: "Waiting for events…",
    agents: {
      Director: "Director",
      Parser: "Parser",
      AssetGen: "Render",
      Composer: "Composer",
    },
    snapshotPrefix: "Pipeline stage",
    completedSuffix: "completed",
    failedPrefix: "failed",
  },
  shotGrid: {
    title: "Parallel workers · BullMQ",
    subtitle: "SHOTS PIPELINE",
    active: "ACTIVE",
    done: "DONE",
    queued: "QUEUED",
    cell: {
      READY: "panel+15s",
      GENERATING_IMAGE: "img…",
      GENERATING_VIDEO: "video…",
      IMAGE_READY: "img ✓",
      FAILED: "retry",
      PENDING: "queued",
    },
    colDualPrompt: "Two prompts (① image ② Seedance)",
    colPanel: "Panel sheet",
    colClip: "Seedance ~15s",
  },
  storyboardPage: {
    backEditor: "Editor",
    progress: "Progress",
    result: "Result",
  },
  storyboardRich: {
    titleSuffix: "Storyboard",
    subtitleTemplate:
      "{count} shots: import → split → MRI → two prompts (image + Seedance) → panel still → Seedance 2.0 with panel first + MRI (~15s, native audio) → stitch per episode.",
    searchPlaceholder: "Search copy, scene, characters…",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    emptyNoData: "No board yet. Save your script and click “Generate video” to parse, build MRI, and write both prompts.",
    emptyFilter: "No shots match your search.",
    epScene: "Sc",
    shotNo: "Shot",
    imagePrompt: "① Panel image prompt (imagePrompt)",
    videoPrompt: "② Seedance video prompt (videoPrompt)",
    rowPrimaryPrompt: "Row primary field (prompt, often mirrors ①)",
    copy: "Copy",
    videoTitle: "~15s clip",
    videoGenerating: "Rendering video…",
    videoNone: "No clip yet",
    keyframe: "Panel render",
    castPrefix: "Cast",
  },
  result: {
    backProjects: "Projects",
    notReadyTitle: "Not ready yet",
    notReadyStatus: "Status",
    viewProgress: "View progress",
    completed: "Completed",
    generatedIn: "Generated in",
    shots: "shots",
    runtime: "Runtime",
    storyboard: "ECP board",
    share: "Share",
    rerender: "Re-render",
    downloadMp4: "Download MP4",
    finalMissing: "Final video URL missing",
    timeline: "Timeline",
    timelineHint: "Drag shots to reorder · click to re-render",
    shotN: "Shot",
    projectInfo: "Project info",
    export: "Export",
    duration: "Duration",
    resolution: "Resolution",
    frameRate: "Frame rate",
    fileSize: "File size",
    cost: "Cost",
    exportMp41080: "MP4 1080p",
    exportMp41080Hint: "Original",
    exportMp44k: "MP4 4K",
    exportMp44kHint: "+50 credits",
    exportGif: "GIF preview",
    exportGifHint: "—",
    exportBundle: "Project bundle",
    exportBundleHint: "shots+masters",
    episodeExportsTitle: "Episode / chapter masters",
    episodeVideoTemplate: "Episode {n}",
    multiEpisodeHint: "Multi-episode projects: one rendered master per episode; download each below.",
  },
  modelSettings: {
    modelsPrefix: "Models",
    defaultModel: "Default",
    dialogTitle: "Model configuration",
    labelText: "Script parsing (text)",
    labelImage: "Scene visualization (image)",
    labelStoryboardImage: "Storyboard panel (keyframe)",
    storyboardImageHelp:
      "Optional override; leave unset to mirror Scene visualization imageModel. Panels use Tencent Hunyuan Image OG (Image 2); legacy Wanxiang values map to OG. Each row renders a photoreal multi-panel sheet; that image is the first video reference, followed by MRI cast/location/prop anchors (max nine reference images total).",
    labelVideo: "Motion (video)",
    labelAspect: "Aspect ratio",
    labelResolution: "Target resolution",
    labelLanguage: "Output language",
    labelEpisodes: "Target episodes",
    episodesHelp: "Number of episodes to generate for this project.",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save changes",
    selectPlaceholder: "Select a model…",
    langZh: "Chinese",
    langEn: "English",
  },
  storyboardPanel: {
    emptyTitle: "No storyboard yet",
    emptyHint:
      "Order: import → split → MRI → two prompts → panel image → Seedance (panel first + MRI, ~15s) → stitch. Click “Generate video” to start.",
    notGenerated: "Storyboard not generated",
    pending: "Pending",
    allGenerated: "All generated",
    generating: "Generating",
    generatingShort: "Generating…",
    queued: "Queued",
  },
  assets: {
    centerTitle: "Assets",
    tabCharacters: "Characters",
    tabScenes: "Scenes",
    tabProps: "Props",
    confirmBtn: "Confirm assets ready — continue",
    confirmDesc: "Continues the pipeline into two-prompt authoring and render jobs",
    confirming: "Submitting…",
    confirmed: "Confirmed, continuing",
  },
  characterPanel: {
    title: "Characters",
    castCount: "cast",
    empty: "No characters extracted yet.",
    noDesc: "No description provided.",
    tip: "Tip: set reference images for consistent look across shots.",
    regenTitle: "Regenerate with AI",
    customImgTitle: "Custom image",
    statusActive: "Active",
    statusAuditing: "Auditing",
    statusFailed: "Failed",
  },
  scenePanel: {
    empty: "No scenes yet.",
    noRef: "No reference image",
    regenerate: "Regenerate",
    upload: "Upload",
    statusActive: "Active",
    statusAuditing: "Auditing",
    statusFailed: "Failed",
  },
  propPanel: {
    empty: "No props detected in the script.",
    noRef: "No image",
    upload: "Upload",
    regen: "Regenerate",
    regenTitle: "Regenerate prop reference image with AI",
  },
  projectStatus: {
    DRAFT: "Draft",
    GENERATING: "Generating",
    COMPLETED: "Completed",
    FAILED: "Failed",
    PAUSED: "Paused",
    CANCELLED: "Cancelled",
  },
  shotStatus: {
    PENDING: "Pending",
    GENERATING_IMAGE: "Image",
    GENERATING_VIDEO: "Video",
    IMAGE_READY: "Img ready",
    READY: "Ready",
    FAILED: "Failed",
  },
  shotType: {
    WIDE: "Wide",
    MEDIUM: "Medium",
    CLOSE_UP: "Close-up",
    OTS: "OTS",
    INSERT: "Insert",
    ESTABLISHING: "Establish",
    POV: "POV",
  },
};

export function getProjectUi(lang: string | null | undefined): ProjectUi {
  return projectLocale(lang) === "en" ? EN_UI : ZH_UI;
}

/** 流水线步骤指示，如「第 2 步，共 4 步」 / "Step 2 of 4" */
export function formatPipelineStepLabel(lang: string | null | undefined, activeIdx: number, total: number): string {
  const loc = projectLocale(lang);
  if (activeIdx < 0) return loc === "zh" ? `— · 共 ${total} 步` : `— · ${total} steps`;
  return loc === "zh"
    ? `第 ${activeIdx + 1} 步，共 ${total} 步`
    : `Step ${activeIdx + 1} of ${total}`;
}

export function projectStatusLabel(lang: string | null | undefined, status: string): string {
  const ui = getProjectUi(lang);
  return ui.projectStatus[status] ?? status;
}

export function shotStatusLabel(lang: string | null | undefined, status: string): string {
  const ui = getProjectUi(lang);
  return ui.shotStatus[status] ?? status;
}

export function shotTypeLabel(lang: string | null | undefined, type: string): string {
  const ui = getProjectUi(lang);
  return ui.shotType[type] ?? type.replace(/_/g, " ");
}

const PIPELINE_STAGE_ZH: Record<string, string> = {
  IDLE: "空闲",
  PARSING: "剧本解析",
  ASSET_GENERATION: "资产生成",
  STORYBOARDING: "双提示词",
  AUDIO: "音频",
  COMPOSING: "成片合成",
  DONE: "流水线就绪",
};

const PIPELINE_STAGE_EN: Record<string, string> = {
  IDLE: "Idle",
  PARSING: "Parsing",
  ASSET_GENERATION: "Assets",
  STORYBOARDING: "Two prompts",
  AUDIO: "Audio",
  COMPOSING: "Composing",
  DONE: "Pipeline idle",
};

export function pipelineStageLabel(lang: string | null | undefined, stage: string): string {
  const m = projectLocale(lang) === "en" ? PIPELINE_STAGE_EN : PIPELINE_STAGE_ZH;
  return m[stage] ?? stage;
}
