import { AppHeader } from "@/app/components/app-header";
import { GrammarDetailClient } from "@/app/components/grammar/grammar-detail-client";
import { getTopNavigationItems } from "@/app/lib/top-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GrammarDetailPageProps = {
  params: Promise<{
    grammarPointId: string;
  }>;
};

export default async function GrammarDetailPage({
  params,
}: GrammarDetailPageProps) {
  const { grammarPointId } = await params;

  return (
    <main className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground">
      <AppHeader navItems={getTopNavigationItems("grammar")} />
      <section className="flex-1 px-[clamp(16px,4vw,40px)] py-[clamp(28px,4vw,44px)]">
        <GrammarDetailClient grammarPointId={grammarPointId} />
      </section>
    </main>
  );
}
