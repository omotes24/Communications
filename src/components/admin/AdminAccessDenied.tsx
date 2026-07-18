import { ADMIN_ACCESS_DENIED_MESSAGE } from "@/lib/auth/admin";

export function AdminAccessDenied() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] px-6 text-[var(--foreground)]">
      <p role="alert" className="text-center text-base font-semibold">
        {ADMIN_ACCESS_DENIED_MESSAGE}
      </p>
    </main>
  );
}
