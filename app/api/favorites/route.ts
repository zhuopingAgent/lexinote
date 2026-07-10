import { NextResponse } from "next/server";
import { getGrammarLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import type { FavoriteGrammarRequest } from "@/shared/types/grammar";

export const runtime = "nodejs";

const grammarLearningService = getGrammarLearningService();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(
      await grammarLearningService.listFavorites(
        url.searchParams.get("userId") ?? undefined
      )
    );
  } catch (error) {
    return toErrorResponse(error, "GET /api/favorites failed");
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<FavoriteGrammarRequest>(request);

    await grammarLearningService.addFavorite(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "POST /api/favorites failed");
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    await grammarLearningService.removeFavorite({
      userId: url.searchParams.get("userId") ?? undefined,
      grammarPointId: url.searchParams.get("grammarPointId") ?? undefined,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error, "DELETE /api/favorites failed");
  }
}
