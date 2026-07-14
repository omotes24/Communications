import { InterviewModule } from "@/modules/interview";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  await requireCurrentUser();

  return <InterviewModule />;
}
