"use client";

import type { GroupDiscussionMap } from "@/lib/schemas/groupDiscussion";
import { cn } from "@/lib/utils";

const typeLabels: Record<GroupDiscussionMap["nodes"][number]["type"], string> = {
  topic: "テーマ",
  assumption: "前提",
  issue: "論点",
  subissue: "小論点",
  criterion: "基準",
  idea: "案",
  pros: "利点",
  cons: "懸念",
  evidence: "根拠",
  risk: "リスク",
  unresolved: "未解決",
  agreement: "合意",
  conclusion: "結論",
  next: "次",
};

const typeClassName: Record<GroupDiscussionMap["nodes"][number]["type"], string> = {
  topic: "bg-neutral-950 text-white",
  assumption: "bg-blue-50 text-blue-900",
  issue: "bg-amber-50 text-amber-900",
  subissue: "bg-amber-50 text-amber-900",
  criterion: "bg-indigo-50 text-indigo-900",
  idea: "bg-emerald-50 text-emerald-900",
  pros: "bg-green-50 text-green-900",
  cons: "bg-red-50 text-red-900",
  evidence: "bg-neutral-100 text-neutral-800",
  risk: "bg-rose-50 text-rose-900",
  unresolved: "bg-purple-50 text-purple-900",
  agreement: "bg-cyan-50 text-cyan-900",
  conclusion: "bg-neutral-950 text-white",
  next: "bg-sky-50 text-sky-900",
};

export function GroupDiscussionMapView({
  map,
  compact = false,
}: {
  map: GroupDiscussionMap;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className={cn("font-semibold", compact ? "text-base" : "text-xl")}>
          議論マップ
        </h2>
        <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-[#6e6e73]">
          {map.nodes.length} nodes
        </span>
      </div>
      <div className="grid gap-2">
        {map.nodes.length === 0 ? (
          <p className="rounded-2xl bg-[#f5f5f7] p-4 text-sm font-medium text-[#6e6e73]">
            発話が入ると、論点・案・結論候補がここに追加されます。
          </p>
        ) : (
          map.nodes.slice(-10).map((node) => (
            <div
              key={node.id}
              className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/[0.06]"
            >
              <div className="flex flex-wrap items-start gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    typeClassName[node.type],
                  )}
                >
                  {typeLabels[node.type]}
                </span>
                <p className="min-w-0 flex-1 text-sm font-semibold leading-6">
                  {node.label}
                </p>
              </div>
              {node.evidenceUtteranceIds.length > 0 ? (
                <p className="mt-2 text-xs font-medium text-[#86868b]">
                  根拠: {node.evidenceUtteranceIds.join(", ")}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
