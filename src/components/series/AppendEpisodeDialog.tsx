"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, X, BookOpen, Film } from "lucide-react";
import { appendEpisode } from "@/app/actions/series";

export function AppendEpisodeDialog({
  seriesId,
  language,
}: {
  seriesId: string;
  language: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [inputType, setInputType] = useState<"SCRIPT" | "NOVEL">("SCRIPT");

  useEffect(() => {
    setMounted(true);
  }, []);
  const isZh = language === "zh";

  const labels = {
    trigger: isZh ? "追加新集" : "Append Episode",
    title: isZh ? "追加新集剧本" : "Append New Episode",
    desc: isZh
      ? "粘贴新集内容。系统自动复用已有角色资产，仅为新角色生成参考图。"
      : "Paste the new episode content. Existing character assets will be reused automatically.",
    contentType: isZh ? "内容类型" : "Content Type",
    script: isZh ? "剧本" : "Script",
    novel: isZh ? "小说" : "Novel",
    placeholder: isZh
      ? "粘贴本集剧本或小说内容…"
      : "Paste episode script or novel content…",
    submit: isZh ? "创建并开始生成" : "Create & Generate",
    cancel: isZh ? "取消" : "Cancel",
    tip: isZh
      ? "角色池中已有的角色不会重新生成参考图，直接复用 Volcengine 资产。"
      : "Characters already in the pool won't regenerate reference images — Volcengine assets are reused directly.",
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent-purple px-4 text-sm font-medium text-white hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        {labels.trigger}
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center bg-black/60 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-border-subtle bg-bg-elevated shadow-2xl">
            {/* Dialog header */}
            <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
              <h2 className="font-semibold">{labels.title}</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-bg-hover hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form action={appendEpisode} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="seriesId" value={seriesId} />
              <input type="hidden" name="inputType" value={inputType} />

              <div className="space-y-5 p-6">
                {/* Content type toggle */}
                <div>
                  <label className="block font-mono text-[10px] font-bold tracking-widest text-fg-subtle uppercase mb-2">
                    {labels.contentType}
                  </label>
                  <div className="flex gap-2">
                    {(["SCRIPT", "NOVEL"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setInputType(t)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border h-10 text-xs font-medium transition-all ${
                          inputType === t
                            ? "border-accent-purple bg-accent-purple/5 text-accent-purple"
                            : "border-border-subtle bg-bg text-fg-muted hover:bg-bg-card"
                        }`}
                      >
                        {t === "SCRIPT" ? <Film className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                        {t === "SCRIPT" ? labels.script : labels.novel}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Script textarea */}
                <div>
                  <textarea
                    name="rawScript"
                    required
                    rows={14}
                    placeholder={labels.placeholder}
                    className="w-full resize-y rounded-lg border border-border-subtle bg-bg p-4 font-mono text-sm leading-relaxed focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
                  />
                </div>

                {/* Tip */}
                <div className="flex items-start gap-2 rounded-lg border border-accent-purple/20 bg-accent-purple/5 px-3.5 py-2.5">
                  <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-purple" />
                  <p className="font-mono text-[11px] leading-relaxed text-accent-purple/80">
                    {labels.tip}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t border-border-subtle px-6 py-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 items-center rounded-lg border border-border-subtle px-4 text-sm text-fg-muted hover:bg-bg-hover"
                >
                  {labels.cancel}
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent-purple px-5 text-sm font-medium text-white hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  {labels.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>,
        document.body
      )}
    </>
  );
}
