import { NextResponse, type NextRequest } from "next/server";
import {
  getTwoFactorSettings,
  TWO_FACTOR_COOKIE_NAME,
  TWO_FACTOR_REQUIRED_CODE,
  TWO_FACTOR_REQUIRED_MESSAGE,
  verifyTwoFactorSessionCookie,
} from "@/shared/auth/two-factor";

const REALM = "LexiNote";
const TWO_FACTOR_PUBLIC_PATHS = [
  "/auth/two-factor",
  "/auth/two-factor/setup",
  "/api/auth/two-factor/verify",
];

function parseBasicAuth(value: string | null) {
  const match = value?.match(/^basic\s+(.+)$/i);

  if (!match) {
    return null;
  }

  try {
    const decoded = atob(match[1]);
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function isTwoFactorPublicPath(pathname: string) {
  return TWO_FACTOR_PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function createTwoFactorChallenge(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: {
          code: TWO_FACTOR_REQUIRED_CODE,
          message: TWO_FACTOR_REQUIRED_MESSAGE,
        },
      },
      { status: 403 }
    );
  }

  const url = request.nextUrl.clone();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  url.pathname = "/auth/two-factor";
  url.search = "";
  url.searchParams.set("next", nextPath);

  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const expectedPassword = process.env.APP_BASIC_AUTH_PASSWORD?.trim();

  if (!expectedPassword) {
    return handleTwoFactorAuth(request);
  }

  const expectedUsername = process.env.APP_BASIC_AUTH_USERNAME?.trim() || "lexinote";
  const credentials = parseBasicAuth(request.headers.get("authorization"));

  if (
    credentials?.username === expectedUsername &&
    credentials.password === expectedPassword
  ) {
    return handleTwoFactorAuth(request);
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}

async function handleTwoFactorAuth(request: NextRequest) {
  const settings = getTwoFactorSettings();

  if (!settings || isTwoFactorPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(TWO_FACTOR_COOKIE_NAME)?.value;
  const hasValidSession = await verifyTwoFactorSessionCookie(
    sessionCookie,
    settings
  );

  return hasValidSession
    ? NextResponse.next()
    : createTwoFactorChallenge(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
