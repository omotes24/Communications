import { ProfileManager } from "@/components/forms/ProfileManager";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requireCurrentUser();

  return <ProfileManager />;
}
