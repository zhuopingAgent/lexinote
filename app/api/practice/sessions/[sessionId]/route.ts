import { NextResponse } from "next/server";
import { toErrorResponse } from "@/app/api/http-error";
import { getPracticeSessionService } from "@/app/api/services";

export const runtime = "nodejs";

const practiceSessionService = getPracticeSessionService();

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const userId = new URL(request.url).searchParams.get("userId") ?? undefined;
    return NextResponse.json(
      await practiceSessionService.getSession(sessionId, userId)
    );
  } catch (error) {
    return toErrorResponse(error, "GET /api/practice/sessions/[sessionId] failed");
  }
}
