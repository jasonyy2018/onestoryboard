"use client";

import * as React from "react";
import { Image as ImageIcon, Plus, Loader2, CheckCircle2, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { updateSceneRefImage, regenerateSceneAsset } from "@/app/actions/projects";
import { getProjectUi } from "@/lib/i18n/project-ui";

interface ScenePanelProps {
  projectId: string;
  scenes: any[];
  lang: string;
}

export function ScenePanel({ projectId, scenes, lang }: ScenePanelProps) {
  const ui = getProjectUi(lang);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const handleUpdateRef = async (sceneId: string) => {
    setUpdatingId(sceneId);
    try {
      const demoUrl = `https://picsum.photos/seed/scene_${sceneId}/800/450`;
      await updateSceneRefImage(sceneId, demoUrl);
    } catch (error) {
      console.error("Failed to update scene image", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRegenerate = async (sceneId: string) => {
    setUpdatingId(sceneId);
    try {
      await regenerateSceneAsset(sceneId);
    } catch (error) {
      console.error("Failed to regenerate scene image", error);
    } finally {
      setUpdatingId(null);
    }
  };

  if (scenes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-sm text-fg-subtle">
        {ui.scenePanel.empty}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {scenes.map((scene) => (
          <div key={scene.id} className="group relative rounded-xl border border-border-subtle bg-bg p-3 transition-all hover:border-accent-purple/30">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-bg-card text-[10px] font-bold text-accent-purple border border-border-subtle">
                    {scene.order}
                  </span>
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-fg truncate max-w-[150px]">
                    {scene.location}
                  </h4>
                </div>
                <StatusBadge status={scene.volcengineStatus} ui={ui} />
              </div>

              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-bg-card border border-border-subtle">
                {scene.refImageUrl ? (
                  <img src={scene.refImageUrl} alt={scene.location} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-fg-subtle opacity-30">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-[10px]">{ui.scenePanel.noRef}</span>
                  </div>
                )}
                {scene.volcengineStatus === "Active" && (
                  <div className="absolute top-2 right-2 z-10 flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-green"></span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleRegenerate(scene.id)}
                    disabled={!!updatingId}
                    className="flex flex-col items-center gap-1 text-white transition-transform hover:scale-105"
                  >
                    {updatingId === scene.id ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <RefreshCw className="h-6 w-6" />
                    )}
                    <span className="text-[10px] font-medium">{ui.scenePanel.regenerate}</span>
                  </button>
                  <div className="mx-2 h-8 w-px bg-white/20" />
                  <button
                    type="button"
                    onClick={() => handleUpdateRef(scene.id)}
                    disabled={!!updatingId}
                    className="flex flex-col items-center gap-1 text-white transition-transform hover:scale-105"
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-[10px] font-medium">{ui.scenePanel.upload}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status, ui }: { status?: string; ui: ReturnType<typeof getProjectUi> }) {
  if (status === "Active")
    return (
      <span className="inline-flex items-center gap-1 rounded bg-accent-green/10 px-1.5 py-0.5 text-[9px] font-bold text-accent-green">
        <CheckCircle2 className="h-2.5 w-2.5" /> {ui.scenePanel.statusActive}
      </span>
    );
  if (status === "Processing")
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-500">
        <Clock className="h-2.5 w-2.5 animate-pulse" /> {ui.scenePanel.statusAuditing}
      </span>
    );
  if (status === "Failed")
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-500">
        <AlertCircle className="h-2.5 w-2.5" /> {ui.scenePanel.statusFailed}
      </span>
    );
  return null;
}
