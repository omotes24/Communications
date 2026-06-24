import { CompanyManager } from "@/components/forms/CompanyManager";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  await requireCurrentUser();

  return <CompanyManager />;
}
