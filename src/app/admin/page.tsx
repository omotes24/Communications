import { AppShell } from "@/components/layout/AppShell";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminUser } from "@/lib/auth/admin";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminUser();

  if (!admin) {
    notFound();
  }

  return (
    <AppShell>
      <AdminDashboard />
    </AppShell>
  );
}
