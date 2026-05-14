"use client";

import { useEffect, useRef, useState } from "react";
import { updateScript } from "@/app/actions/projects";
import { getProjectUi } from "@/lib/i18n/project-ui";

export function ScriptEditor({
  projectId,
  initialValue,
  lang,
}: {
  projectId: string;
  initialValue: string;
  lang: string;
}) {
  const ui = getProjectUi(lang);
  const [value, setValue] = useState(initialValue);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (value === initialValue) return;
    timer.current = setTimeout(async () => {
      await updateScript(projectId, value);
      setSavedAt(new Date());
    }, 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, projectId, initialValue]);

  const localeTag = lang === "en" ? "en-US" : "zh-CN";

  return (
    <div className="flex flex-1 flex-col">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 resize-none bg-bg p-7 font-mono text-sm leading-relaxed focus:outline-none"
        spellCheck={false}
      />
      <div className="flex h-7 items-center justify-end border-t border-border-subtle px-5 font-mono text-[10px] text-fg-subtle">
        {savedAt
          ? `${ui.editor.saved} ${savedAt.toLocaleTimeString(localeTag)}`
          : ui.editor.autoSaveOn}
      </div>
    </div>
  );
}
