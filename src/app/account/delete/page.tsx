import { DeleteAccountPanel } from "@/components/account/DeleteAccountPanel";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  await requireCurrentUser();

  return (
    <AppShell>
      <PageHeader
        title="Delete Account"
        description="関連データを含めてアカウントを削除します。"
      />
      <DeleteAccountPanel />
    </AppShell>
  );
}
