import { NextResponse, type NextRequest } from "next/server";

const REALM = "LexiNote";

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

export function proxy(request: NextRequest) {
  const expectedPassword = process.env.APP_BASIC_AUTH_PASSWORD?.trim();

  if (!expectedPassword) {
    return NextResponse.next();
  }

  const expectedUsername = process.env.APP_BASIC_AUTH_USERNAME?.trim() || "lexinote";
  const credentials = parseBasicAuth(request.headers.get("authorization"));

  if (
    credentials?.username === expectedUsername &&
    credentials.password === expectedPassword
  ) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
