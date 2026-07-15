import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { getAdminUser } from "@/lib/auth/admin";

export async function AdminHomeLink() {
  const admin = await getAdminUser();

  if (!admin) return null;

  return (
    <Link
      href="/admin"
      className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--foreground)] px-6 text-sm font-semibold text-[var(--background)] shadow-sm ring-1 ring-[var(--border)] transition hover:opacity-80"
    >
      <ShieldCheck className="h-4 w-4" aria-hidden />
      管理画面
    </Link>
  );
}
