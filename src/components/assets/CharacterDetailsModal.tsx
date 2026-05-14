"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ShieldCheck, UserPlus, Info } from "lucide-react";
import { ingestCharacterAsset } from "@/app/actions/assets";

interface Character {
  id: string;
  name: string;
  description: string | null;
  personality: string | null;
  background: string | null;
  visualPrompt: string | null;
  refImageUrl: string | null;
  volcengineStatus: string | null;
}

export function CharacterDetailsModal({ 
  character, 
  onClose 
}: { 
  character: Character; 
  onClose: () => void 
}) {
  const [loading, setLoading] = useState(false);

  const handleIngest = async () => {
    setLoading(true);
    try {
      await ingestCharacterAsset(character.id);
      alert("已提交火山引擎审核，请耐心等待状态更新。");
    } catch (e) {
      alert("提交失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-elevated shadow-2xl md:flex-row">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Left: Image */}
        <div className="relative aspect-3/4 w-full bg-bg md:h-full md:w-2/5">
          {character.refImageUrl ? (
            <Image
              src={character.refImageUrl}
              alt={character.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-fg-subtle">
              No Image
            </div>
          )}
        </div>

        {/* Right: Content */}
        <div className="flex flex-1 flex-col overflow-y-auto p-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">{character.name}</h2>
              <div className="mt-2 flex items-center gap-2">
                {character.volcengineStatus === "Active" ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-accent-green">
                    <ShieldCheck className="h-3 w-3" />
                    已通过火山引擎审核
                  </span>
                ) : (
                  <span className="text-xs text-fg-subtle">未审核资产</span>
                )}
              </div>
            </div>

            <button
              onClick={handleIngest}
              disabled={loading || character.volcengineStatus === "Active"}
              className="flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {loading ? "提交中..." : "增加真人角色"}
            </button>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-accent-purple">
                <Info className="h-4 w-4" />
                <h3 className="text-sm font-bold uppercase tracking-wider">背景 & 故事</h3>
              </div>
              <div className="rounded-xl bg-bg p-4 text-sm leading-relaxed text-fg-muted">
                {character.background || "暂无背景信息"}
              </div>

              <div className="flex items-center gap-2 text-accent-purple">
                <Info className="h-4 w-4" />
                <h3 className="text-sm font-bold uppercase tracking-wider">性格特征</h3>
              </div>
              <div className="rounded-xl bg-bg p-4 text-sm leading-relaxed text-fg-muted">
                {character.personality || "暂无性格描述"}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-accent-purple">
                <Info className="h-4 w-4" />
                <h3 className="text-sm font-bold uppercase tracking-wider">角色介绍 (Script)</h3>
              </div>
              <div className="rounded-xl bg-bg p-4 text-sm leading-relaxed text-fg-muted">
                {character.description || "暂无脚本介绍"}
              </div>

              <div className="flex items-center gap-2 text-accent-purple">
                <Info className="h-4 w-4" />
                <h3 className="text-sm font-bold uppercase tracking-wider">视觉提示词 (Visual Prompt)</h3>
              </div>
              <div className="rounded-xl bg-bg-card p-4 font-mono text-[11px] leading-relaxed text-fg-subtle border border-border-subtle">
                {character.visualPrompt || "暂无视觉提示词"}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
