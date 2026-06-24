import { Suspense } from "react";

import { AuthForm } from "@/components/auth/AuthForm";
import { AppShell } from "@/components/layout/AppShell";

export default function LoginPage() {
  return (
    <AppShell>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </AppShell>
  );
}
