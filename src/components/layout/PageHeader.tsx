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
    <div className={cn("flex items-end gap-4", dense ? "mb-3" : compact ? "mb-4" : "mb-5")}>
      <div className="min-w-0 flex-1">
      <p
        className={cn(
          "text-xs font-bold uppercase tracking-[0.35px] text-[var(--accent)]",
          dense ? "mb-1 text-[10px]" : "mb-1.5",
        )}
      >
        {appName}
      </p>
      <h1
        className={cn(
          dense ? "text-[25px] leading-[30px]" : compact ? "text-[28px] leading-8" : "text-[32px] leading-[38px]",
          "font-extrabold tracking-[-1.05px]",
          isDark ? "text-white" : "text-[#1d1d1f]",
        )}
      >
        {title}
      </h1>
      {description ? (
        <p
          className={cn(
            "mt-1.5 max-w-[660px] text-sm font-normal leading-[21px]",
            isDark ? "text-white/60" : "text-[#6e6e73]",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
      </div>
    </div>
  );
}
