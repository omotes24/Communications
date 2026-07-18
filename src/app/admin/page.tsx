import { AppShell } from "@/components/layout/AppShell";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminUser } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminUser();

  if (!admin) {
    return <AdminAccessDenied />;
  }

  return (
    <AppShell>
      <AdminDashboard />
    </AppShell>
  );
}
