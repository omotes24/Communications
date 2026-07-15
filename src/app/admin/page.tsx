import { AppShell } from "@/components/layout/AppShell";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminUser } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminUser();

  if (!admin) {
    redirect("/");
  }

  return (
    <AppShell>
      <AdminDashboard />
    </AppShell>
  );
}
