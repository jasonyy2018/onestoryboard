import { cn } from "@/lib/utils";

export type BadgeColor = "purple" | "pink" | "cyan" | "green" | "amber" | "red" | "neutral";

const COLOR: Record<BadgeColor, { dot: string; border: string }> = {
  purple: { dot: "bg-accent-purple", border: "border-accent-purple/40" },
  pink: { dot: "bg-accent-pink", border: "border-accent-pink/40" },
  cyan: { dot: "bg-accent-cyan", border: "border-accent-cyan/40" },
  green: { dot: "bg-accent-green", border: "border-accent-green/40" },
  amber: { dot: "bg-accent-amber", border: "border-accent-amber/40" },
  red: { dot: "bg-accent-red", border: "border-accent-red/40" },
  neutral: { dot: "bg-fg-subtle", border: "border-border-subtle" },
};

export function Badge({
  color = "neutral",
  children,
  className,
  withDot = true,
}: {
  color?: BadgeColor;
  children: React.ReactNode;
  className?: string;
  withDot?: boolean;
}) {
  const c = COLOR[color];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-bg-card px-2.5 py-0.5 font-mono text-[10px] tracking-wider text-fg-muted",
        c.border,
        className,
      )}
    >
      {withDot && <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />}
      {children}
    </span>
  );
}
