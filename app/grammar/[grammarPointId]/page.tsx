import { AppHeader } from "@/app/components/app-header";
import { GrammarDetailClient } from "@/app/components/grammar/grammar-detail-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOP_NAV_ITEMS = [
  { label: "辞書", href: "/", active: false },
  { label: "文法", href: "/grammar", active: true },
];

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
      <AppHeader navItems={TOP_NAV_ITEMS} />
      <section className="flex-1 px-[clamp(16px,4vw,40px)] py-[clamp(28px,4vw,44px)]">
        <GrammarDetailClient grammarPointId={grammarPointId} />
      </section>
    </main>
  );
}
