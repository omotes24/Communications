import { Suspense } from "react";

import { AuthForm } from "@/components/auth/AuthForm";
import { AppShell } from "@/components/layout/AppShell";

export default function SignUpPage() {
  return (
    <AppShell>
      <Suspense>
        <AuthForm mode="sign-up" />
      </Suspense>
    </AppShell>
  );
}
