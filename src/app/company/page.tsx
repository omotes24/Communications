import { CompanyManager } from "@/components/forms/CompanyManager";
import { AppShell } from "@/components/layout/AppShell";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  await requireCurrentUser();

  return (
    <AppShell>
      <CompanyManager />
    </AppShell>
  );
}
