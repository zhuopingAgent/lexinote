import QRCode from "qrcode";
import { notFound } from "next/navigation";
import {
  createTotpOtpAuthUri,
  getTwoFactorSettings,
  getTwoFactorSetupProfile,
  sanitizeTwoFactorRedirect,
  verifyTwoFactorSetupToken,
} from "@/shared/auth/two-factor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TwoFactorSetupPageProps = {
  searchParams: Promise<{
    next?: string;
    token?: string;
  }>;
};

function formatSecret(secret: string) {
  return secret.match(/.{1,4}/gu)?.join(" ") ?? secret;
}

export default async function TwoFactorSetupPage({
  searchParams,
}: TwoFactorSetupPageProps) {
  const { next, token } = await searchParams;
  const settings = getTwoFactorSettings();

  if (!settings || !verifyTwoFactorSetupToken(token)) {
    notFound();
  }

  const { account, issuer } = getTwoFactorSetupProfile();
  const otpAuthUri = createTotpOtpAuthUri({
    account,
    issuer,
    secret: settings.totpSecret,
  });
  const qrSvg = await QRCode.toString(otpAuthUri, {
    errorCorrectionLevel: "M",
    margin: 1,
    type: "svg",
    width: 220,
  });
  const safeNext = sanitizeTwoFactorRedirect(next);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-[480px] rounded-lg border border-border bg-surface p-[clamp(24px,5vw,36px)] shadow-[0_18px_44px_var(--shadow)]">
        <div className="mb-7">
          <p className="mb-2 text-sm font-semibold text-accent">LexiNote</p>
          <h1 className="text-2xl font-semibold text-foreground">
            绑定 Authenticator
          </h1>
        </div>

        <div className="mb-6 flex justify-center rounded-md border border-border bg-white p-4">
          <div
            aria-label="Authenticator QR code"
            className="size-[220px]"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>

        <div className="mb-6 rounded-md border border-border bg-surface-soft p-4">
          <p className="mb-2 text-sm font-medium text-foreground">手动密钥</p>
          <p className="break-all font-mono text-sm tracking-[0.08em] text-muted">
            {formatSecret(settings.totpSecret)}
          </p>
        </div>

        <form
          action="/api/auth/two-factor/verify"
          className="flex flex-col gap-4"
          method="post"
        >
          <input name="next" type="hidden" value={safeNext} />

          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            首次验证码
            <input
              autoComplete="one-time-code"
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

          <button
            className="h-12 rounded-md bg-accent px-4 text-sm font-semibold text-black transition hover:bg-accent-strong focus:outline-none focus:ring-4 focus:ring-accent-soft"
            type="submit"
          >
            完成绑定
          </button>
        </form>
      </section>
    </main>
  );
}
