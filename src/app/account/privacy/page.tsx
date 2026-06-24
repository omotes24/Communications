import { AppShell } from "@/components/layout/AppShell";
import { PrivacyScreen } from "@/components/privacy/PrivacyScreen";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AccountPrivacyPage() {
  await requireCurrentUser();

  return (
    <AppShell>
      <PrivacyScreen />
    </AppShell>
  );
}
