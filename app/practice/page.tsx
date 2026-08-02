import { AppHeader } from "@/app/components/app-header";
import { PracticeClient } from "@/app/components/grammar/practice-client";
import { getTopNavigationItems } from "@/app/lib/top-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PracticePageProps = {
  searchParams: Promise<{
    grammarId?: string;
    comparisonSetId?: string;
    mode?: string;
  }>;
};

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const { grammarId, comparisonSetId, mode } = await searchParams;
  const entryMode =
    mode === "daily" || mode === "review"
      ? mode
      : grammarId
        ? "focus"
        : "daily";

  return (
    <main className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground">
      <AppHeader navItems={getTopNavigationItems("grammar")} />
      <section className="flex-1 px-[clamp(16px,4vw,40px)] py-[clamp(28px,4vw,44px)]">
        <PracticeClient
          grammarPointId={grammarId}
          comparisonSetId={comparisonSetId}
          entryMode={entryMode}
        />
      </section>
    </main>
  );
}
