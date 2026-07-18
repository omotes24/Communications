import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { AdminAnalyticsDashboard } from "@/components/admin/AdminAnalyticsDashboard";
import { AppShell } from "@/components/layout/AppShell";
import { getAdminUser } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const admin = await getAdminUser();

  if (!admin) {
    return <AdminAccessDenied />;
  }

  return (
    <AppShell>
      <AdminAnalyticsDashboard />
    </AppShell>
  );
}
