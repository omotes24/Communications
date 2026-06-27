import { GroupDiscussionSessionScreen } from "@/components/group-discussion/GroupDiscussionSessionScreen";
import { AppShell } from "@/components/layout/AppShell";

export default async function GroupDiscussionSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <AppShell>
      <GroupDiscussionSessionScreen sessionId={sessionId} />
    </AppShell>
  );
}
