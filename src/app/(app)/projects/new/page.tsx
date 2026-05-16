"use client";

import React, { useState } from "react";
import { createProject } from "@/app/actions/projects";
import { createSerialSeries, createFullSeries } from "@/app/actions/series";
import { BookOpen, Film, Layers, List } from "lucide-react";

type InputType = "SCRIPT" | "NOVEL";
type Language = "zh" | "en";
type ProjectMode = "SINGLE" | "SERIAL" | "FULL";

export default function NewProjectPage() {
  const [inputType, setInputType] = useState<InputType>("SCRIPT");
  const [language, setLanguage] = useState<Language>("zh");
  const [mode, setMode] = useState<ProjectMode>("SINGLE");

  const isZh = language === "zh";

  const modeLabels = {
    SINGLE: {
      label: isZh ? "单集项目" : "Single Episode",
      desc: isZh ? "生成一集短剧视频" : "Generate a single episode",
      icon: <Film className="h-4 w-4" />,
    },
    SERIAL: {
      label: isZh ? "连载剧集" : "Serial Series",
      desc: isZh ? "逐集追加，角色资产自动复用" : "Append episodes, assets reused automatically",
      icon: <List className="h-4 w-4" />,
    },
    FULL: {
      label: isZh ? "整部导入" : "Full Import",
      desc: isZh ? "一次导入完整剧本，自动按集拆分" : "Import full script, auto-split by episode",
      icon: <Layers className="h-4 w-4" />,
    },
  };

  const labels = {
    pageTitle: isZh ? "新建项目" : "New Project",
    pageDesc: isZh ? "选择创作模式，导入剧本或小说" : "Choose a mode and import your script or novel",
    projectMode: isZh ? "创作模式" : "Project Mode",
    projectName: isZh ? "项目名称" : "Project Name",
    namePlaceholderSingle: isZh ? "例：乱世惊变 第一集" : "e.g. Rise of Chaos — Episode 1",
    namePlaceholderSeries: isZh ? "例：乱世惊变（全剧）" : "e.g. Rise of Chaos (Series)",
    contentType: isZh ? "内容类型" : "Content Type",
    scriptLabel: isZh ? "剧本" : "Script",
    novelLabel: isZh ? "小说" : "Novel",
    outputLang: isZh ? "输出语言" : "Output Language",
    langNote: isZh
      ? "无论输入是英文还是中文，输出一律翻译为中文"
      : "All content will be translated into English regardless of input language",
    episodeCount: isZh ? "集数" : "Episodes",
    contentLabel: isZh
      ? inputType === "SCRIPT" ? "剧本内容" : "小说内容"
      : inputType === "SCRIPT" ? "Script Content" : "Novel Content",
    contentHint: {
      SINGLE: isZh ? "粘贴单集剧本或小说内容" : "Paste single episode content",
      SERIAL: isZh ? "粘贴第 1 集内容，后续可在系列页面逐集追加" : "Paste Episode 1 content — append more episodes from the series page",
      FULL: isZh ? "粘贴完整剧本，系统将按 [[EPISODE X]] 或章节标记自动拆分" : "Paste full script — auto-split by [[EPISODE X]] or chapter markers",
    },
    placeholder: isZh
      ? inputType === "SCRIPT"
        ? "粘贴剧本内容…"
        : "粘贴小说内容，AI 将自动改编为短剧剧本…"
      : inputType === "SCRIPT"
        ? "Paste script content…"
        : "Paste novel content — AI will adapt it into a screenplay…",
    submit: {
      SINGLE: isZh ? "创建单集项目" : "Create Single Episode",
      SERIAL: isZh ? "创建连载系列并开始第 1 集" : "Create Series & Start Episode 1",
      FULL: isZh ? "导入完整剧本并拆分" : "Import & Split Episodes",
    },
  };

  const action = mode === "SERIAL" ? createSerialSeries : mode === "FULL" ? createFullSeries : createProject;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <form
        action={action}
        className="w-full max-w-2xl space-y-6 rounded-xl border border-border-subtle bg-bg-elevated p-8 shadow-sm"
      >
        {/* Header */}
        <div className="space-y-1 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/10">
            <Film className="h-5 w-5 text-accent-purple" />
          </div>
          <h1 className="text-lg font-bold">{labels.pageTitle}</h1>
          <p className="text-sm text-fg-muted">{labels.pageDesc}</p>
        </div>

        {/* Mode selector */}
        <div>
          <label className="block font-mono text-[10px] font-bold tracking-widest text-fg-subtle uppercase mb-2">
            {labels.projectMode}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["SINGLE", "SERIAL", "FULL"] as ProjectMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                  mode === m
                    ? "border-accent-purple bg-accent-purple/5"
                    : "border-border-subtle bg-bg hover:bg-bg-card"
                }`}
              >
                <div className={`${mode === m ? "text-accent-purple" : "text-fg-muted"}`}>
                  {modeLabels[m].icon}
                </div>
                <span className={`text-xs font-semibold ${mode === m ? "text-accent-purple" : "text-fg"}`}>
                  {modeLabels[m].label}
                </span>
                <span className="text-[11px] leading-snug text-fg-muted">
                  {modeLabels[m].desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Project name */}
        <div>
          <label className="block font-mono text-[10px] font-bold tracking-widest text-fg-subtle uppercase mb-1.5">
            {labels.projectName}
          </label>
          <input
            name="title"
            required
            placeholder={mode === "SINGLE" ? labels.namePlaceholderSingle : labels.namePlaceholderSeries}
            className="h-11 w-full rounded-lg border border-border-subtle bg-bg px-4 text-sm transition-all focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
          />
        </div>

        {/* Type · Language · (Episodes for SINGLE) */}
        <div className={`grid gap-4 ${mode === "SINGLE" ? "grid-cols-3" : "grid-cols-2"}`}>
          {/* Content type */}
          <div>
            <label className="block font-mono text-[10px] font-bold tracking-widest text-fg-subtle uppercase mb-1.5">
              {labels.contentType}
            </label>
            <div className="flex gap-1.5">
              {(["SCRIPT", "NOVEL"] as InputType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setInputType(t)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg border h-10 text-xs font-medium transition-all ${
                    inputType === t
                      ? "border-accent-purple bg-accent-purple/5 text-accent-purple"
                      : "border-border-subtle bg-bg text-fg-muted hover:bg-bg-card"
                  }`}
                >
                  {t === "SCRIPT" ? <Film className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                  {t === "SCRIPT" ? labels.scriptLabel : labels.novelLabel}
                </button>
              ))}
            </div>
            <input type="hidden" name="inputType" value={inputType} />
          </div>

          {/* Output language */}
          <div>
            <label className="block font-mono text-[10px] font-bold tracking-widest text-fg-subtle uppercase mb-1.5">
              {labels.outputLang}
            </label>
            <div className="flex gap-1.5">
              {(["zh", "en"] as Language[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  className={`flex flex-1 items-center justify-center rounded-lg border h-10 text-xs font-bold transition-all ${
                    language === l
                      ? "border-accent-purple bg-accent-purple/5 text-accent-purple"
                      : "border-border-subtle bg-bg text-fg-muted hover:bg-bg-card"
                  }`}
                >
                  {l === "zh" ? "中文" : "EN"}
                </button>
              ))}
            </div>
            <input type="hidden" name="language" value={language} />
          </div>

          {/* Episode count — only for SINGLE mode */}
          {mode === "SINGLE" && (
            <div>
              <label className="block font-mono text-[10px] font-bold tracking-widest text-fg-subtle uppercase mb-1.5">
                {labels.episodeCount}
              </label>
              <input
                name="episodeCount"
                type="number"
                min={1}
                max={50}
                defaultValue={1}
                className="h-10 w-full rounded-lg border border-border-subtle bg-bg px-3 text-sm focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
              />
            </div>
          )}
        </div>

        {/* Language note */}
        <div className="flex items-start gap-2 rounded-lg border border-accent-purple/20 bg-accent-purple/5 px-3.5 py-2.5">
          <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-purple" />
          <p className="font-mono text-[11px] leading-relaxed text-accent-purple/80">
            {mode !== "SINGLE"
              ? labels.contentHint[mode]
              : labels.langNote}
          </p>
        </div>

        {/* Script content */}
        <div>
          <label className="block font-mono text-[10px] font-bold tracking-widest text-fg-subtle uppercase mb-1.5">
            {labels.contentLabel}
          </label>
          <textarea
            name="rawScript"
            required
            rows={16}
            placeholder={labels.placeholder}
            className="w-full resize-y rounded-lg border border-border-subtle bg-bg p-4 font-mono text-sm leading-relaxed transition-all focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
          />
        </div>

        {/* Model info bar */}
        <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg px-4 py-2.5">
          <div className="h-1.5 w-1.5 rounded-full bg-accent-green" />
          <span className="font-mono text-[11px] text-fg-muted">
            Doubao 2.0 · 腾讯 OG Image 2 · Seedance 2.0
          </span>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-accent-purple text-sm font-bold text-white shadow-lg shadow-accent-purple/20 transition-all hover:opacity-90 active:scale-[0.98]"
        >
          <Film className="h-4 w-4" />
          {labels.submit[mode]}
        </button>
      </form>
    </div>
  );
}
