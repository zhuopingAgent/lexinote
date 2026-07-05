import { sanitizeTwoFactorRedirect } from "@/shared/auth/two-factor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TwoFactorPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function TwoFactorPage({
  searchParams,
}: TwoFactorPageProps) {
  const { error, next } = await searchParams;
  const safeNext = sanitizeTwoFactorRedirect(next);
  const showError = error === "invalid";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-[420px] rounded-lg border border-border bg-surface p-[clamp(24px,5vw,36px)] shadow-[0_18px_44px_var(--shadow)]">
        <div className="mb-7">
          <p className="mb-2 text-sm font-semibold text-accent">LexiNote</p>
          <h1 className="text-2xl font-semibold text-foreground">双重验证</h1>
        </div>

        <form
          action="/api/auth/two-factor/verify"
          className="flex flex-col gap-4"
          method="post"
        >
          <input name="next" type="hidden" value={safeNext} />

          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            验证码
            <input
              autoComplete="one-time-code"
              autoFocus
              className="h-12 rounded-md border border-border bg-surface-strong px-4 text-center font-mono text-xl tracking-[0.24em] text-foreground outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              name="code"
              pattern="[0-9]*"
              required
              type="text"
            />
          </label>

          {showError ? (
            <p className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
              验证码无效或已过期。
            </p>
          ) : null}

          <button
            className="mt-2 h-12 rounded-md bg-accent px-4 text-sm font-semibold text-black transition hover:bg-accent-strong focus:outline-none focus:ring-4 focus:ring-accent-soft"
            type="submit"
          >
            验证
          </button>
        </form>
      </section>
    </main>
  );
}
