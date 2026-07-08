import { AppShell } from "@/components/layout/AppShell";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  const admin = user ? await getAdminUser() : null;

  if (!admin) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-black/[0.08]">
          <h1 className="text-2xl font-semibold tracking-tight">
            管理ダッシュボード
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-[#3f3f46]">
            {user
              ? "このページは管理者専用です。管理者権限が必要な場合は、環境変数 ADMIN_EMAILS にあなたのメールアドレスを追加してもらってください。"
              : "このページは管理者専用です。管理者アカウントでログインしてください。"}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AdminDashboard />
    </AppShell>
  );
}
