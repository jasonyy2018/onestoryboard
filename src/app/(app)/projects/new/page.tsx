"use client";

import React, { useState } from "react";
import { createProject } from "@/app/actions/projects";
import { BookOpen, Film } from "lucide-react";

type InputType = "SCRIPT" | "NOVEL";
type Language = "zh" | "en";

export default function NewProjectPage() {
  const [inputType, setInputType] = useState<InputType>("SCRIPT");
  const [language, setLanguage] = useState<Language>("zh");

  const isZh = language === "zh";

  const labels = {
    pageTitle: isZh ? "新建短剧项目" : "New Short Drama Project",
    pageDesc: isZh
      ? "导入剧本或小说，一键生成完整短剧视频"
      : "Import a script or novel and generate a complete short drama",
    projectName: isZh ? "项目名称" : "Project Name",
    namePlaceholder: isZh ? "例：乱世惊变 第一集" : "e.g. Rise of Chaos — Episode 1",
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
    placeholder: isZh
      ? inputType === "SCRIPT"
        ? "粘贴剧本内容，支持标准剧本格式（EXT./INT. 场景头，角色名：对白）…"
        : "粘贴小说内容，AI 将自动改编为短剧剧本并拆解镜头…"
      : inputType === "SCRIPT"
        ? "Paste script content (standard format: EXT./INT. headings, CHARACTER: dialogue)…"
        : "Paste novel content — AI will adapt it into a screenplay and break it into shots…",
    submit: isZh ? "创建项目并开始生成" : "Create Project & Generate",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <form
        action={createProject}
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

        {/* Project name */}
        <div>
          <label className="block font-mono text-[10px] font-bold tracking-widest text-fg-subtle uppercase mb-1.5">
            {labels.projectName}
          </label>
          <input
            name="title"
            required
            placeholder={labels.namePlaceholder}
            className="h-11 w-full rounded-lg border border-border-subtle bg-bg px-4 text-sm transition-all focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
          />
        </div>

        {/* Type · Language · Episodes — 3-col grid */}
        <div className="grid grid-cols-3 gap-4">
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

          {/* Episode count */}
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
        </div>

        {/* Language note */}
        <div className="flex items-start gap-2 rounded-lg border border-accent-purple/20 bg-accent-purple/5 px-3.5 py-2.5">
          <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-purple" />
          <p className="font-mono text-[11px] leading-relaxed text-accent-purple/80">
            {labels.langNote}
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
          {labels.submit}
        </button>
      </form>
    </div>
  );
}
