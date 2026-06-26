import { HistoryScreen } from "@/components/history/HistoryScreen";
import { AppShell } from "@/components/layout/AppShell";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  await requireCurrentUser();

  return (
    <AppShell>
      <HistoryScreen />
    </AppShell>
  );
}
