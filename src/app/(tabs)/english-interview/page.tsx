import { SupportScreen } from "@/components/support/SupportScreen";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function EnglishInterviewPage() {
  await requireCurrentUser();

  return <SupportScreen variant="english" />;
}
