"use client";

import * as React from "react";
import { Box, Image as ImageIcon, Plus, Loader2, CheckCircle2, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { updatePropRefImage, regeneratePropAsset } from "@/app/actions/projects";
import { getProjectUi } from "@/lib/i18n/project-ui";

interface PropPanelProps {
  projectId: string;
  props: any[];
  lang: string;
}

export function PropPanel({ projectId, props, lang }: PropPanelProps) {
  const ui = getProjectUi(lang);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const handleUpdateRef = async (propId: string) => {
    setUpdatingId(propId);
    try {
      const demoUrl = `https://picsum.photos/seed/prop_${propId}/400/400`;
      await updatePropRefImage(propId, demoUrl);
    } catch (error) {
      console.error("Failed to update prop image", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRegenerate = async (propId: string) => {
    setUpdatingId(propId);
    try {
      await regeneratePropAsset(propId);
    } catch (error) {
      console.error("Failed to regenerate prop image", error);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {props.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
            <Box className="h-8 w-8 text-fg-subtle opacity-20" />
            <p className="text-xs text-fg-subtle">{ui.propPanel.empty}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {props.map((prop) => (
            <div key={prop.id} className="group relative rounded-xl border border-border-subtle bg-bg p-2 transition-all hover:border-accent-purple/30">
              <div className="space-y-2">
                <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border-subtle bg-bg-card">
                  {prop.refImageUrl ? (
                    <img src={prop.refImageUrl} alt={prop.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-fg-subtle opacity-30">
                      <ImageIcon className="h-5 w-5" />
                      <span className="text-[9px]">{ui.propPanel.noRef}</span>
                    </div>
                  )}
                  {/* Hover overlay: regenerate + upload */}
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleRegenerate(prop.id)}
                      disabled={!!updatingId}
                      title={ui.propPanel.regenTitle}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-purple/80 text-white transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
                    >
                      {updatingId === prop.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateRef(prop.id)}
                      disabled={!!updatingId}
                      title={ui.propPanel.upload}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-bg-card text-white/80 transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="truncate text-[10px] font-bold uppercase tracking-wider text-fg">{prop.name}</h4>
                  <StatusBadge status={prop.volcengineStatus} ui={ui} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, ui }: { status?: string; ui: ReturnType<typeof getProjectUi> }) {
  if (status === "Active")
    return (
      <span className="inline-flex items-center gap-1 text-[8px] font-bold text-accent-green">
        <CheckCircle2 className="h-2 w-2" /> {ui.characterPanel.statusActive}
      </span>
    );
  if (status === "Processing")
    return (
      <span className="inline-flex items-center gap-1 text-[8px] font-bold text-amber-500">
        <Clock className="h-2 w-2 animate-pulse" /> {ui.characterPanel.statusAuditing}
      </span>
    );
  if (status === "Failed")
    return (
      <span className="inline-flex items-center gap-1 text-[8px] font-bold text-red-500">
        <AlertCircle className="h-2 w-2" /> {ui.characterPanel.statusFailed}
      </span>
    );
  return null;
}
