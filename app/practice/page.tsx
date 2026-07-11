import { AppHeader } from "@/app/components/app-header";
import { PracticeClient } from "@/app/components/grammar/practice-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOP_NAV_ITEMS = [
  { label: "辞書", href: "/", active: false },
  { label: "文法", href: "/grammar", active: true },
];

type PracticePageProps = {
  searchParams: Promise<{
    grammarId?: string;
    mode?: string;
  }>;
};

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const { grammarId, mode } = await searchParams;
  const entryMode =
    mode === "daily" || mode === "review"
      ? mode
      : grammarId
        ? "focus"
        : "daily";

  return (
    <main className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground">
      <AppHeader navItems={TOP_NAV_ITEMS} />
      <section className="flex-1 px-[clamp(16px,4vw,40px)] py-[clamp(28px,4vw,44px)]">
        <PracticeClient grammarPointId={grammarId} entryMode={entryMode} />
      </section>
    </main>
  );
}
