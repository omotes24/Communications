import { ProfileManager } from "@/components/forms/ProfileManager";
import { AppShell } from "@/components/layout/AppShell";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requireCurrentUser();

  return (
    <AppShell>
      <ProfileManager />
    </AppShell>
  );
}
