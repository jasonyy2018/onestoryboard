"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal } from "lucide-react";
import { getProjectUi, pipelineStageLabel, projectStatusLabel } from "@/lib/i18n/project-ui";
import { pipelineSnapshotSignature } from "@/lib/pipeline/pipeline-snapshot-signature";

type LogAgent = "Director" | "Parser" | "AssetGen" | "Composer";

interface LogEntry {
  ts: string;
  agent: LogAgent;
  level: "info" | "warn" | "error";
  message: string;
}

const AGENT_COLOR: Record<LogAgent, string> = {
  Director: "bg-accent-purple",
  Parser: "bg-accent-cyan",
  AssetGen: "bg-accent-amber",
  Composer: "bg-accent-green",
};

export function ActivityLog({ projectId, lang }: { projectId: string; lang: string }) {
  const ui = getProjectUi(lang);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSnapshotSig = useRef<string>("");
  const lastProgressKey = useRef<string>("");

  useEffect(() => {
    lastSnapshotSig.current = "";
    lastProgressKey.current = "";
    setLogs([]);
    const es = new EventSource(`/api/projects/${projectId}/events`);

    es.addEventListener("snapshot", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data);
      if (!data) return;
      const sig = pipelineSnapshotSignature(data);
      if (sig === lastSnapshotSig.current) return;
      lastSnapshotSig.current = sig;
      const u = getProjectUi(lang);
      pushLog({
        agent: "Director",
        level: "info",
        message: `${u.activityLog.snapshotPrefix} ${pipelineStageLabel(lang, data.pipelineStage)} · ${projectStatusLabel(lang, data.status)}`,
      });
    });

    es.addEventListener("progress", (ev) => {
      const { queue, jobId, data } = JSON.parse((ev as MessageEvent).data);
      const key = `${queue}|${jobId}|${JSON.stringify(data)}`;
      if (key === lastProgressKey.current) return;
      lastProgressKey.current = key;
      pushLog({
        agent: queueToAgent(queue),
        level: "info",
        message: `${jobId} · ${JSON.stringify(data)}`,
      });
    });

    es.addEventListener("completed", (ev) => {
      const { queue, jobId } = JSON.parse((ev as MessageEvent).data);
      const u = getProjectUi(lang);
      pushLog({
        agent: queueToAgent(queue),
        level: "info",
        message: `${jobId} ${u.activityLog.completedSuffix}`,
      });
    });

    es.addEventListener("failed", (ev) => {
      const { queue, jobId, failedReason } = JSON.parse((ev as MessageEvent).data);
      const u = getProjectUi(lang);
      pushLog({
        agent: queueToAgent(queue),
        level: "error",
        message: `${jobId} ${u.activityLog.failedPrefix}: ${failedReason}`,
      });
    });

    es.addEventListener("done", () => es.close());
    return () => es.close();

    function pushLog(p: Omit<LogEntry, "ts">) {
      setLogs((prev) =>
        [...prev, { ...p, ts: new Date().toLocaleTimeString(lang === "en" ? "en-US" : "zh-CN") }].slice(-200),
      );
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      );
    }
  }, [projectId, lang]);

  return (
    <>
      <header className="flex h-12 items-center gap-2 border-b border-border-subtle px-5">
        <Terminal className="h-3.5 w-3.5 text-accent-cyan" />
        <span className="text-sm font-medium">{ui.activityLog.header}</span>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-accent-green">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
          {ui.activityLog.live}
        </span>
      </header>

      <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
        {logs.length === 0 && (
          <p className="font-mono text-xs text-fg-subtle">{ui.activityLog.waiting}</p>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="font-mono text-[10px] text-fg-subtle">{log.ts}</span>
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="inline-flex items-center gap-1.5">
                <span className={`h-3.5 w-3.5 rounded-sm ${AGENT_COLOR[log.agent]}`} />
                <span
                  className={`font-mono text-[10px] font-semibold ${
                    log.level === "error" ? "text-accent-red" : "text-fg"
                  }`}
                >
                  {ui.activityLog.agents[log.agent]}
                </span>
              </div>
              <p
                className={`break-words text-xs leading-relaxed ${
                  log.level === "error" ? "text-accent-red" : "text-fg"
                }`}
              >
                {log.message}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </>
  );
}

function queueToAgent(q: string): LogAgent {
  if (q === "shot" || q === "asset") return "AssetGen";
  if (q === "compose") return "Composer";
  if (q === "parse") return "Parser";
  return "Director";
}
