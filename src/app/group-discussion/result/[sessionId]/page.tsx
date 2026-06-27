import { GroupDiscussionResultScreen } from "@/components/group-discussion/GroupDiscussionResultScreen";
import { AppShell } from "@/components/layout/AppShell";

export default async function GroupDiscussionResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <AppShell>
      <GroupDiscussionResultScreen sessionId={sessionId} />
    </AppShell>
  );
}
