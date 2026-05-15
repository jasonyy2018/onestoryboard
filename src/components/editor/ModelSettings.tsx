"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Settings2, X } from "lucide-react";
import { updateModelConfig } from "@/app/actions/projects";
import { getProjectUi } from "@/lib/i18n/project-ui";

interface ModelSettingsProps {
  projectId: string;
  currentConfig: Record<string, unknown> | null;
  episodeCount: number;
  language: string;
  trigger?: React.ReactNode;
}

export function ModelSettings({ projectId, currentConfig, episodeCount, language, trigger }: ModelSettingsProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [epCount, setEpCount] = React.useState(episodeCount);
  const [isSaving, setIsSaving] = React.useState(false);
  const ui = getProjectUi(language);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateModelConfig(projectId, {
        ...(currentConfig || {}),
        episodeCount: epCount,
        language: "zh",
        textModel: "doubao-seed-2-0",
        imageModel: "tencent-og-medium",
        storyboardImageModel: "tencent-og-medium",
        videoModel: "seedance-2.0-fast",
      });
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        {trigger || (
          <button className="inline-flex h-8 items-center gap-1.5 rounded border border-border-subtle bg-bg-card px-3 text-xs transition-colors hover:bg-bg-hover">
            <Settings2 className="h-3 w-3 text-fg-muted" />
            <span className="font-mono text-[10px] text-fg-muted uppercase">
              {epCount}集
            </span>
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-strong bg-bg-elevated p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-base font-semibold">项目设置</Dialog.Title>
            <Dialog.Close className="rounded-full p-1 text-fg-subtle hover:bg-bg-hover">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Fixed model stack */}
          <div className="mb-5 space-y-2 rounded-lg border border-border-subtle bg-bg p-3.5">
            <div className="font-mono text-[10px] tracking-widest text-fg-subtle uppercase mb-3">使用模型（固定）</div>
            {[
              { label: "文本 / 剧本解析", value: "Doubao Seed 2.0" },
              { label: "故事板生图", value: "腾讯 OG Image 2 (Medium)" },
              { label: "视频生成", value: "Seedance 2.0 Fast" },
              { label: "备用生图", value: "万相 2.7（OG 失败时自动切换）" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-fg-muted">{item.label}</span>
                <span className="font-mono text-[11px] font-medium">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Episode count */}
          <div className="space-y-2 mb-6">
            <label className="block font-mono text-[10px] font-bold tracking-widest text-fg-subtle uppercase">
              集数
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={epCount}
                onChange={(e) => setEpCount(parseInt(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border-subtle accent-accent-purple"
              />
              <div className="flex h-9 w-14 items-center justify-center rounded-lg border border-border-subtle bg-bg font-mono text-sm font-bold">
                {epCount}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="h-9 px-4 text-sm font-medium text-fg-subtle hover:text-fg">取消</button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 rounded-lg bg-accent-purple px-5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20 disabled:opacity-50"
            >
              {isSaving ? "保存中…" : "保存"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
