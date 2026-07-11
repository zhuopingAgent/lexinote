import { NextResponse } from "next/server";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import { getPracticeSessionService } from "@/app/api/services";
import type { PracticeSessionCreateRequest } from "@/shared/types/practice";

export const runtime = "nodejs";

const practiceSessionService = getPracticeSessionService();

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<PracticeSessionCreateRequest>(request);
    return NextResponse.json(await practiceSessionService.createSession(body), {
      status: 201,
    });
  } catch (error) {
    return toErrorResponse(error, "POST /api/practice/sessions failed");
  }
}
