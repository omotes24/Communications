import { requireApiUser } from "@/lib/auth/server";
import { getWalletBalance } from "@/lib/tokens/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  const wallet = await getWalletBalance(auth.user.id);
  return Response.json({
    id: auth.user.id,
    email: auth.user.email,
    wallet,
  });
}
