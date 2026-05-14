"use client";

import * as React from "react";
import type { Character } from "@prisma/client";
import { User, Image as ImageIcon, Plus, Loader2, UserCircle2, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { updateCharacterRefImage, regenerateCharacterAsset } from "@/app/actions/projects";
import { getProjectUi } from "@/lib/i18n/project-ui";

interface CharacterPanelProps {
  projectId: string;
  characters: Character[];
  lang: string;
}

export function CharacterPanel({ projectId, characters, lang }: CharacterPanelProps) {
  const ui = getProjectUi(lang);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const handleUpdateRef = async (charId: string) => {
    setUpdatingId(charId);
    try {
      const demoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${charId}`;
      await updateCharacterRefImage(charId, demoUrl);
    } catch (error) {
      console.error("Failed to update character image", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRegenerate = async (charId: string) => {
    setUpdatingId(charId);
    try {
      await regenerateCharacterAsset(charId);
    } catch (error) {
      console.error("Failed to regenerate character image", error);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg-elevated">
      <header className="flex h-11 items-center gap-2 border-b border-border-subtle px-5">
        <UserCircle2 className="h-3.5 w-3.5 text-accent-purple" />
        <span className="text-sm font-medium">{ui.characterPanel.title}</span>
        <span className="font-mono text-xs text-fg-muted">
          · {characters.length} {ui.characterPanel.castCount}
        </span>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {characters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
            <User className="h-8 w-8 text-fg-subtle opacity-20" />
            <p className="text-xs text-fg-subtle">{ui.characterPanel.empty}</p>
          </div>
        )}

        {characters.map((char) => (
          <div key={char.id} className="group relative rounded-xl border border-border-subtle bg-bg p-3 transition-all hover:border-accent-purple/30">
            <div className="flex items-start gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-bg-card border border-border-subtle">
                {char.refImageUrl ? (
                  <img src={char.refImageUrl} alt={char.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-fg-subtle opacity-30">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                {char.volcengineStatus === "Active" && (
                  <div className="absolute top-1 right-1 flex h-2 w-2 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-green"></span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleRegenerate(char.id)}
                    disabled={!!updatingId}
                    title={ui.characterPanel.regenTitle}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-purple/80 text-white transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
                  >
                    {updatingId === char.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateRef(char.id)}
                    disabled={!!updatingId}
                    title={ui.characterPanel.customImgTitle}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-bg-card text-white/80 transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-fg">{char.name}</h4>
                  <StatusBadge status={char.volcengineStatus} ui={ui} />
                </div>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-fg-muted">
                  {char.description || ui.characterPanel.noDesc}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border-subtle bg-bg-card/50">
        <p className="text-[10px] leading-normal text-fg-subtle italic">{ui.characterPanel.tip}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status, ui }: { status?: string | null; ui: ReturnType<typeof getProjectUi> }) {
  if (status === "Active")
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded">
        <CheckCircle2 className="h-2.5 w-2.5" /> {ui.characterPanel.statusActive}
      </span>
    );
  if (status === "Processing")
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
        <Clock className="h-2.5 w-2.5 animate-pulse" /> {ui.characterPanel.statusAuditing}
      </span>
    );
  if (status === "Failed")
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
        <AlertCircle className="h-2.5 w-2.5" /> {ui.characterPanel.statusFailed}
      </span>
    );
  return null;
}
