import { AppHeader } from "@/app/components/app-header";
import { ReviewClient } from "@/app/components/grammar/review-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOP_NAV_ITEMS = [
  { label: "辞書", href: "/", active: false },
  { label: "文法", href: "/grammar", active: true },
];

export default function ReviewPage() {
  return (
    <main className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground">
      <AppHeader navItems={TOP_NAV_ITEMS} />
      <section className="flex-1 px-[clamp(16px,4vw,40px)] py-[clamp(28px,4vw,44px)]">
        <ReviewClient />
      </section>
    </main>
  );
}
