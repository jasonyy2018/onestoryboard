"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Clapperboard, Copy, Film, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { StoryboardShotRow } from "./storyboard-types";
import { getProjectUi, projectLocale, shotStatusLabel, shotTypeLabel } from "@/lib/i18n/project-ui";

function statusColor(status: string): "green" | "amber" | "red" | "neutral" {
  if (status === "READY") return "green";
  if (status === "FAILED") return "red";
  if (status === "GENERATING_IMAGE" || status === "GENERATING_VIDEO") return "amber";
  return "neutral";
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text).catch(() => {
    // ignore
  });
}

function RichBlock({
  title,
  content,
  mono,
  copyLabel,
}: {
  title: string;
  content: string;
  mono?: boolean;
  copyLabel: string;
}) {
  if (!content?.trim()) return null;
  return (
    <div className="rounded-md border border-border-subtle bg-bg-card/60 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-cyan">
          {title}
        </span>
        <button
          type="button"
          onClick={() => copyText(content)}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-fg-muted hover:bg-bg-hover hover:text-fg"
          title={copyLabel}
        >
          <Copy className="h-3 w-3" />
          {copyLabel}
        </button>
      </div>
      <div
        className={`text-sm leading-relaxed text-fg ${mono ? "font-mono text-[13px]" : ""} max-h-48 overflow-y-auto whitespace-pre-wrap`}
      >
        {content}
      </div>
    </div>
  );
}

export function StoryboardRichView({
  projectTitle,
  rows,
  compact,
  lang,
}: {
  projectTitle: string;
  rows: StoryboardShotRow[];
  compact?: boolean;
  lang: string;
}) {
  const ui = getProjectUi(lang);
  const [query, setQuery] = React.useState("");
  const [expandAll, setExpandAll] = React.useState(!compact);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = [
        r.sceneLocation,
        r.prompt,
        r.imagePrompt,
        r.videoPrompt,
        r.characterNames.join(" "),
        r.type,
        r.cameraMove,
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, query]);

  const subtitle = ui.storyboardRich.subtitleTemplate.replace("{count}", String(rows.length));

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {ui.storyboardRich.titleSuffix} · {projectTitle}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ui.storyboardRich.searchPlaceholder}
              className="h-9 w-full rounded-md border border-border-subtle bg-bg-card py-1.5 pl-8 pr-3 text-sm placeholder:text-fg-subtle focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
            />
          </div>
          <button
            type="button"
            onClick={() => setExpandAll((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-3 text-xs font-medium text-fg-muted hover:border-border-strong hover:text-fg"
          >
            {expandAll ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {expandAll ? ui.storyboardRich.collapseAll : ui.storyboardRich.expandAll}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong p-12 text-center text-sm text-fg-muted">
          {rows.length === 0 ? ui.storyboardRich.emptyNoData : ui.storyboardRich.emptyFilter}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <ShotRichRow key={row.shotId} row={row} forceOpen={expandAll} compact={compact} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShotRichRow({
  row,
  forceOpen,
  compact,
  lang,
}: {
  row: StoryboardShotRow;
  forceOpen: boolean;
  compact?: boolean;
  lang: string;
}) {
  const ui = getProjectUi(lang);
  const loc = projectLocale(lang);
  const [open, setOpen] = React.useState(forceOpen);
  React.useEffect(() => {
    setOpen(forceOpen);
  }, [forceOpen]);

  const sceneLabel =
    loc === "zh"
      ? `第${row.episodeNumber}集 · ${ui.storyboardRich.epScene}${row.sceneOrder}`
      : `Ep. ${row.episodeNumber} · Scene ${row.sceneOrder}`;
  const shotLabel = `${row.sceneOrder}.${row.shotOrder}`;
  const typeLabel = shotTypeLabel(lang, row.type);
  const statusLabel = shotStatusLabel(lang, row.status);

  return (
    <article
      className={`overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated ${compact ? "" : "shadow-sm"}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 border-b border-border-subtle bg-bg-card/40 px-4 py-3 text-left transition-colors hover:bg-bg-card/70"
      >
        <span className="mt-0.5 text-fg-subtle">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-accent-purple">{row.globalIndex}</span>
            <span className="font-mono text-[11px] text-fg-muted">{sceneLabel}</span>
            <span className="text-sm font-medium text-fg">{row.sceneLocation}</span>
            {row.timeOfDay && <span className="text-xs text-fg-subtle">{row.timeOfDay}</span>}
            <Badge color="neutral" withDot={false} className="font-mono text-[10px]">
              {ui.storyboardRich.shotNo} {shotLabel}
            </Badge>
            <Badge color="cyan" withDot={false} className="font-mono text-[10px]">
              {typeLabel}
            </Badge>
            {row.cameraMove && (
              <Badge color="neutral" withDot={false} className="font-mono text-[10px]">
                {row.cameraMove}
              </Badge>
            )}
            <span className="font-mono text-[10px] text-fg-subtle">{row.duration}s</span>
            <Badge color={statusColor(row.status)} withDot={false} className="font-mono text-[10px]">
              {statusLabel}
            </Badge>
          </div>
          {row.characterNames.length > 0 && (
            <div className="mt-1.5 font-mono text-[10px] text-fg-muted">
              {ui.storyboardRich.castPrefix}：{row.characterNames.join(" · ")}
            </div>
          )}
        </div>
      </button>

      {open && (
        <div className={`grid gap-4 p-4 ${compact ? "lg:grid-cols-1" : "lg:grid-cols-[1fr_minmax(260px,360px)]"}`}>
          <div className="space-y-3 min-w-0">
            <RichBlock
              title={ui.storyboardRich.imagePrompt}
              content={row.imagePrompt || ""}
              copyLabel={ui.storyboardRich.copy}
            />
            <RichBlock
              title={ui.storyboardRich.videoPrompt}
              content={row.videoPrompt || ""}
              copyLabel={ui.storyboardRich.copy}
            />
            <RichBlock
              title={ui.storyboardRich.rowPrimaryPrompt}
              content={row.prompt}
              mono
              copyLabel={ui.storyboardRich.copy}
            />
            {row.errorMsg && (
              <div className="rounded-md border border-accent-red/40 bg-accent-red/5 p-3 text-sm text-accent-red">
                {row.errorMsg}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
              <Film className="h-3.5 w-3.5" />
              {ui.storyboardRich.videoTitle}
            </div>
            {row.videoUrl ? (
              <video
                src={row.videoUrl}
                controls
                playsInline
                className="w-full rounded-lg border border-border-subtle bg-black"
                preload="metadata"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border-strong bg-bg text-sm text-fg-muted">
                {row.status === "GENERATING_VIDEO" ? ui.storyboardRich.videoGenerating : ui.storyboardRich.videoNone}
              </div>
            )}
            {row.imageUrl && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                  <Clapperboard className="h-3.5 w-3.5" />
                  {ui.storyboardRich.keyframe}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={row.imageUrl} alt="" className="max-h-48 w-full rounded-md border border-border-subtle object-contain" />
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
