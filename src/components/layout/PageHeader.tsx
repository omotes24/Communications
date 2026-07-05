import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  descriptionClassName,
  tone = "light",
  compact = false,
  dense = false,
}: {
  title: string;
  description?: string;
  descriptionClassName?: string;
  tone?: "light" | "dark";
  compact?: boolean;
  dense?: boolean;
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Yell for You 1.2";
  const isDark = tone === "dark";

  return (
    <div
      className={cn(
        dense
          ? "mb-3 border-b pb-3"
          : compact
            ? "mb-4 border-b pb-4"
            : "mb-8 border-b pb-6",
        isDark ? "border-white/10" : "border-black/[0.08]",
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]",
          dense ? "mb-1 text-[10px]" : compact ? "mb-2" : "mb-3",
        )}
      >
        {appName}
      </p>
      <h1
        className={cn(
          dense
            ? "text-2xl font-semibold tracking-tight sm:text-3xl"
            : compact
            ? "text-3xl font-semibold tracking-tight sm:text-4xl"
            : "text-4xl font-semibold tracking-tight sm:text-6xl",
          isDark ? "text-white" : "text-[#1d1d1f]",
        )}
      >
        {title}
      </h1>
      {description ? (
        <p
          className={cn(
            "mt-4 max-w-3xl text-base font-medium leading-8",
            isDark ? "text-white/60" : "text-[#6e6e73]",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
