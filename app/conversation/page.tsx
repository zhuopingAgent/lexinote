import { AppHeader } from "@/app/components/app-header";
import { ConversationClient } from "@/app/components/conversation/conversation-client";
import { getTopNavigationItems } from "@/app/lib/top-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function ConversationPage() {
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <AppHeader navItems={getTopNavigationItems("conversation")} />
      <ConversationClient />
    </main>
  );
}
