import { NextResponse } from "next/server";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import { getPracticeSessionService } from "@/app/api/services";

export const runtime = "nodejs";

const practiceSessionService = getPracticeSessionService();

type RouteContext = {
  params: Promise<{ exerciseId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { exerciseId } = await context.params;
    const body = await readJsonBody<{ userId?: string }>(request);
    return NextResponse.json(
      await practiceSessionService.revealHint(exerciseId, body.userId)
    );
  } catch (error) {
    return toErrorResponse(
      error,
      "POST /api/practice/exercises/[exerciseId]/hints failed"
    );
  }
}
