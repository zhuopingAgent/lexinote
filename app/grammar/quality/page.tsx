import { AppHeader } from "@/app/components/app-header";
import { PracticeQualityClient } from "@/app/components/grammar/practice-quality-client";
import { getTopNavigationItems } from "@/app/lib/top-navigation";

export default function PracticeQualityPage() {
  return (
    <main className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground">
      <AppHeader navItems={getTopNavigationItems("grammar")} />
      <section className="flex-1 px-[clamp(16px,4vw,40px)] py-[clamp(24px,3vw,36px)]">
        <PracticeQualityClient />
      </section>
    </main>
  );
}
