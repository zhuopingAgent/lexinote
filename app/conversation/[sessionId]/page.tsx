import { AppHeader } from "@/app/components/app-header";
import { ConversationClient } from "@/app/components/conversation/conversation-client";
import { getTopNavigationItems } from "@/app/lib/top-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ConversationSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <AppHeader navItems={getTopNavigationItems("conversation")} />
      <ConversationClient initialSessionId={sessionId} />
    </main>
  );
}
