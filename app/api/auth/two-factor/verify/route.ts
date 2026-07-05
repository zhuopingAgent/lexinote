import { NextResponse, type NextRequest } from "next/server";
import {
  createTwoFactorSessionCookie,
  getTwoFactorSettings,
  sanitizeTwoFactorRedirect,
  TWO_FACTOR_COOKIE_NAME,
  verifyTotpCode,
} from "@/shared/auth/two-factor";

export const runtime = "nodejs";

async function readSubmission(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Partial<{
      code: unknown;
      next: unknown;
    }>;

    return {
      code: typeof body.code === "string" ? body.code : "",
      next: typeof body.next === "string" ? body.next : undefined,
    };
  }

  const formData = await request.formData();

  return {
    code: String(formData.get("code") ?? ""),
    next: String(formData.get("next") ?? ""),
  };
}

function redirectTo(request: NextRequest, pathname: string, status = 303) {
  return NextResponse.redirect(new URL(pathname, request.url), status);
}

function redirectToInvalidCode(request: NextRequest, next: string) {
  const url = new URL("/auth/two-factor", request.url);

  url.searchParams.set("error", "invalid");
  url.searchParams.set("next", next);

  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const { code, next } = await readSubmission(request);
  const nextPath = sanitizeTwoFactorRedirect(next);
  const settings = getTwoFactorSettings();

  if (!settings) {
    return redirectTo(request, nextPath);
  }

  const isValidCode = await verifyTotpCode(settings.totpSecret, code);

  if (!isValidCode) {
    return redirectToInvalidCode(request, nextPath);
  }

  const response = redirectTo(request, nextPath);
  const sessionCookie = await createTwoFactorSessionCookie(settings);

  response.cookies.set({
    httpOnly: true,
    maxAge: settings.sessionSeconds,
    name: TWO_FACTOR_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: sessionCookie,
  });

  return response;
}
