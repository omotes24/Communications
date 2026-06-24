import { Suspense } from "react";

import { AuthForm } from "@/components/auth/AuthForm";
import { AppShell } from "@/components/layout/AppShell";

export default function ForgotPasswordPage() {
  return (
    <AppShell>
      <Suspense>
        <AuthForm mode="forgot-password" />
      </Suspense>
    </AppShell>
  );
}
