import { AppShell } from "@/components/layout/AppShell";
import { SupportScreen } from "@/components/support/SupportScreen";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  await requireCurrentUser();

  return (
    <AppShell>
      <SupportScreen />
    </AppShell>
  );
}
