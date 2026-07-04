import { NextResponse } from "next/server";
import { getGrammarLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import type { FavoriteGrammarRequest } from "@/shared/types/api";
import { ValidationError } from "@/shared/utils/errors";

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
    let body: Partial<FavoriteGrammarRequest>;

    try {
      body = (await request.json()) as Partial<FavoriteGrammarRequest>;
    } catch {
      throw new ValidationError("request body must be valid JSON");
    }

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
