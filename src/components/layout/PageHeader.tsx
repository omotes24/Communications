import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  tone = "light",
}: {
  title: string;
  description?: string;
  tone?: "light" | "dark";
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Yell for You 1.2";
  const isDark = tone === "dark";

  return (
    <div
      className={cn(
        "mb-8 border-b pb-6",
        isDark ? "border-white/10" : "border-black/[0.08]",
      )}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
        {appName}
      </p>
      <h1
        className={cn(
          "text-4xl font-semibold tracking-tight sm:text-6xl",
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
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
