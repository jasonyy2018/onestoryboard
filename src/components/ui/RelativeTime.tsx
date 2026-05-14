"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils";

/**
 * Renders relative time only after mount so SSR HTML matches the first client paint
 * (avoids hydration mismatch from Date.now() drift between server and browser).
 */
export function RelativeTime({
  date,
  className,
}: {
  date: Date | string;
  className?: string;
}) {
  const ts = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const [text, setText] = useState("");

  useEffect(() => {
    const d = new Date(ts);
    const tick = () => setText(formatRelativeTime(d));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [ts]);

  return (
    <span className={className} title={new Date(ts).toISOString()}>
      {text || "\u00a0"}
    </span>
  );
}
