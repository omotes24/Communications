import { CompanyIntelligenceScreen } from "@/components/company-intelligence/CompanyIntelligenceScreen";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function CompanyIntelligencePage() {
  await requireCurrentUser();

  return <CompanyIntelligenceScreen />;
}
