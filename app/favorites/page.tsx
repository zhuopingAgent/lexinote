import { AppHeader } from "@/app/components/app-header";
import { FavoritesClient } from "@/app/components/grammar/favorites-client";
import { getTopNavigationItems } from "@/app/lib/top-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function FavoritesPage() {
  return (
    <main className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground">
      <AppHeader navItems={getTopNavigationItems("grammar")} />
      <section className="flex-1 px-[clamp(16px,4vw,40px)] py-[clamp(28px,4vw,44px)]">
        <FavoritesClient />
      </section>
    </main>
  );
}
