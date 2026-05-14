"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Folder, Image as ImageIcon, Users, Settings2, Plus, Globe, ChevronDown, ChevronRight, Map, Box } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

function useQueueStats() {
  const [stats, setStats] = React.useState({ active: 0, waiting: 0, total: 0 });
  React.useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/queue/stats");
        if (res.ok && !cancelled) setStats(await res.json());
      } catch {}
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return stats;
}

export function Sidebar({ projectCount = 0 }: { projectCount?: number }) {
  const { t, language, setLanguage } = useTranslation();
  const [isAssetsOpen, setIsAssetsOpen] = React.useState(true);
  const queue = useQueueStats();
  const pct = queue.total > 0 ? Math.round((queue.active / queue.total) * 100) : 0;

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col gap-6 bg-bg-elevated p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-purple">
          <Sparkles className="h-[18px] w-[18px] text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{t.sidebar.appName}</span>
          <span className="font-mono text-[10px] text-fg-subtle">{t.sidebar.appSub}</span>
        </div>
      </div>

      <Link
        href="/projects/new"
        className="flex h-10 items-center justify-center gap-2 rounded-md bg-accent-purple text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> {t.sidebar.newProject}
      </Link>

      <nav className="flex flex-col gap-0.5">
        <div className="px-2.5 pb-1 font-mono text-[10px] tracking-widest text-fg-subtle uppercase">
          {t.sidebar.workspace}
        </div>
        <NavItem icon={<Folder className="h-4 w-4 text-accent-purple" />} active label={t.sidebar.projects} badge={String(projectCount)} />
        
        <div>
          <button 
            onClick={() => setIsAssetsOpen(!isAssetsOpen)}
            className="flex h-9 w-full items-center gap-2.5 rounded px-2.5 text-left text-sm text-fg-muted transition-colors hover:text-fg"
          >
            <ImageIcon className="h-4 w-4" />
            <span className="flex-1">{(t.sidebar as any).assetCenter}</span>
            {isAssetsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          
          {isAssetsOpen && (
            <div className="mt-0.5 flex flex-col gap-0.5 pl-9">
              <NavItem 
                icon={<Users className="h-3.5 w-3.5" />} 
                label={(t.sidebar as any).characterLib} 
                onClick={() => window.location.href = "/assets/characters"}
                small
              />
              <NavItem 
                icon={<Map className="h-3.5 w-3.5" />} 
                label={(t.sidebar as any).sceneLib} 
                onClick={() => window.location.href = "/assets/scenes"}
                small
              />
              <NavItem 
                icon={<Box className="h-3.5 w-3.5" />} 
                label={(t.sidebar as any).propLib} 
                onClick={() => window.location.href = "/assets/props"}
                small
              />
            </div>
          )}
        </div>

        <NavItem 
          icon={<Settings2 className="h-4 w-4" />} 
          label={t.sidebar.settings} 
          onClick={() => alert("请进入具体项目进行模型配置")}
        />
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-md border border-border-subtle bg-bg-card p-3.5 text-xs">
          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-fg-muted uppercase">
            <span className={`h-1.5 w-1.5 rounded-full ${queue.active > 0 ? "bg-accent-green animate-pulse" : "bg-fg-subtle"}`} />
            {t.sidebar.queueActive}
          </div>
          <div className="mt-1.5 text-sm font-medium">
            {queue.active > 0 ? `${queue.active} ${t.sidebar.jobsRunning}` : "—"}
          </div>
          {queue.total > 0 && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg">
              <div className="h-full rounded-full bg-accent-purple transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>

        <button
          onClick={() => setLanguage(language === "en" ? "zh" : "en")}
          className="flex h-9 w-full items-center justify-between rounded px-2.5 text-sm text-fg-muted transition-colors hover:bg-bg-card hover:text-fg"
        >
          <div className="flex items-center gap-2.5">
            <Globe className="h-4 w-4" />
            <span>{t.sidebar.language}</span>
          </div>
          <span className="font-mono text-[11px] font-medium uppercase text-fg-subtle">
            {language === "en" ? "EN" : "中"}
          </span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  badge,
  active,
  small,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  active?: boolean;
  small?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded px-2.5 text-left transition-colors ${
        small ? "h-8 text-[13px]" : "h-9 text-sm"
      } ${
        active ? "bg-bg-card text-fg" : "text-fg-muted hover:text-fg"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge && <span className="font-mono text-[11px] text-fg-muted">{badge}</span>}
    </button>
  );
}
