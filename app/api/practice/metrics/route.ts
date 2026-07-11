import { NextResponse } from "next/server";
import { toErrorResponse } from "@/app/api/http-error";
import { getPracticeSessionService } from "@/app/api/services";

export const runtime = "nodejs";

const practiceSessionService = getPracticeSessionService();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(
      await practiceSessionService.getGenerationMetrics(
        url.searchParams.get("since") ?? undefined
      )
    );
  } catch (error) {
    return toErrorResponse(error, "GET /api/practice/metrics failed");
  }
}
