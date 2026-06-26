import { Suspense } from "react";

import { ResetPasswordPanel } from "@/components/auth/ResetPasswordPanel";
import { AppShell } from "@/components/layout/AppShell";

export default function ResetPasswordPage() {
  return (
    <AppShell>
      <Suspense>
        <ResetPasswordPanel />
      </Suspense>
    </AppShell>
  );
}
