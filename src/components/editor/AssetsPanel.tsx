"use client";

import * as React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { UserCircle2, Map as MapIcon, Box, CheckCheck, Loader2, ArrowRight, Wand2 } from "lucide-react";
import Link from "next/link";
import { CharacterPanel } from "./CharacterPanel";
import { ScenePanel } from "./ScenePanel";
import { PropPanel } from "./PropPanel";
import { getProjectUi } from "@/lib/i18n/project-ui";
import { confirmAssetsReady } from "@/app/actions/assets";
import { generateAllProjectAssets } from "@/app/actions/projects";

interface AssetsPanelProps {
  projectId: string;
  characters: any[];
  scenes: any[];
  props: any[];
  lang: string;
  pipelineStage?: string;
}

export function AssetsPanel({ projectId, characters, scenes, props, lang }: AssetsPanelProps) {
  const ui = getProjectUi(lang);
  const [confirming, setConfirming] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const [generatingAll, setGeneratingAll] = React.useState(false);

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    try {
      await generateAllProjectAssets(projectId);
    } catch (err) {
      console.error("generateAllProjectAssets failed", err);
    } finally {
      setGeneratingAll(false);
    }
  };

  // Show the confirm banner whenever there are assets to review
  const hasAssets = characters.length > 0 || scenes.length > 0 || props.length > 0;
  const showConfirmBanner = hasAssets;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await confirmAssetsReady(projectId);
      setConfirmed(true);
    } catch {
      setConfirming(false);
    }
  };

  return (
    <Tabs.Root defaultValue="characters" className="flex h-full flex-col bg-bg-elevated">
      <div className="flex h-11 items-center gap-2 px-4 border-b border-border-subtle bg-bg-elevated">
        <span className="flex-1 text-[11px] font-bold uppercase tracking-widest text-fg-subtle">{ui.assets.centerTitle}</span>
        <button
          type="button"
          onClick={handleGenerateAll}
          disabled={generatingAll}
          title={ui.assets.tabCharacters.includes("角") ? "批量生成所有缺失的参考图（5张并发）" : "Batch-generate all missing reference images (5 concurrent)"}
          className="flex items-center gap-1 rounded-md bg-accent-purple/10 px-2 py-1 text-[10px] font-semibold text-accent-purple transition-colors hover:bg-accent-purple/20 disabled:opacity-50"
        >
          {generatingAll ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Wand2 className="h-3 w-3" />
          )}
          {generatingAll
            ? (ui.assets.tabCharacters.includes("角") ? "生成中…" : "Generating…")
            : (ui.assets.tabCharacters.includes("角") ? "生成全部" : "Generate all")}
        </button>
      </div>
      <Tabs.List className="flex h-12 shrink-0 items-center gap-1 border-b border-border-subtle bg-bg-elevated px-2">
        <Tabs.Trigger
          value="characters"
          className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md py-1 text-[10px] font-bold text-fg-muted transition-all data-[state=active]:bg-bg-card data-[state=active]:text-accent-purple data-[state=active]:shadow-sm"
        >
          <UserCircle2 className="h-4 w-4" />
          <span>{ui.assets.tabCharacters}</span>
        </Tabs.Trigger>
        <Tabs.Trigger
          value="scenes"
          className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md py-1 text-[10px] font-bold text-fg-muted transition-all data-[state=active]:bg-bg-card data-[state=active]:text-accent-purple data-[state=active]:shadow-sm"
        >
          <MapIcon className="h-4 w-4" />
          <span>{ui.assets.tabScenes}</span>
        </Tabs.Trigger>
        <Tabs.Trigger
          value="props"
          className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md py-1 text-[10px] font-bold text-fg-muted transition-all data-[state=active]:bg-bg-card data-[state=active]:text-accent-purple data-[state=active]:shadow-sm"
        >
          <Box className="h-4 w-4" />
          <span>{ui.assets.tabProps}</span>
        </Tabs.Trigger>
      </Tabs.List>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <Tabs.Content value="characters" className="h-full outline-none">
            <CharacterPanel projectId={projectId} characters={characters} lang={lang} />
          </Tabs.Content>
          <Tabs.Content value="scenes" className="h-full outline-none">
            <ScenePanel projectId={projectId} scenes={scenes} lang={lang} />
          </Tabs.Content>
          <Tabs.Content value="props" className="h-full outline-none">
            <PropPanel projectId={projectId} props={props} lang={lang} />
          </Tabs.Content>
        </div>

        {showConfirmBanner && (
          <div className="shrink-0 border-t border-accent-green/20 bg-accent-green/5 p-3 space-y-2">
            {confirmed ? (
              <div className="flex items-center justify-between rounded-lg bg-accent-green/20 px-3 py-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-accent-green">
                  <CheckCheck className="h-3.5 w-3.5" />
                  {ui.assets.confirmed}
                </span>
                <Link
                  href={`/projects/${projectId}/progress`}
                  className="flex items-center gap-1 text-[10px] font-medium text-accent-green/80 hover:text-accent-green"
                >
                  {ui.assets.tabCharacters.includes("角") ? "查看进度" : "View progress"}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <>
                <p className="text-[10px] leading-snug text-fg-muted">{ui.assets.confirmDesc}</p>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-green px-3 py-2 text-xs font-semibold text-black transition-opacity disabled:opacity-60"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {ui.assets.confirming}
                    </>
                  ) : (
                    <>
                      <CheckCheck className="h-3.5 w-3.5" />
                      {ui.assets.confirmBtn}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </Tabs.Root>
  );
}
