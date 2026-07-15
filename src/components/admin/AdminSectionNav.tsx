import Link from "next/link";
import { BarChart3, Gauge } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  {
    id: "overview",
    href: "/admin",
    label: "経営ダッシュボード",
    icon: Gauge,
  },
  {
    id: "analytics",
    href: "/admin/analytics",
    label: "アクセス分析",
    icon: BarChart3,
  },
] as const;

export function AdminSectionNav({
  active,
}: {
  active: (typeof items)[number]["id"];
}) {
  return (
    <nav
      aria-label="管理画面"
      className="mb-5 flex w-fit max-w-full gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-1 shadow-sm backdrop-blur-xl"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const selected = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition sm:px-4",
              selected
                ? "bg-[var(--accent)] text-[var(--accent-on)] shadow-sm"
                : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
