import { NextResponse } from "next/server";
import { WordLookupService } from "@/features/word-lookup/application/WordLookupService";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";
import { AIExplanationService } from "@/features/ai-explanation/application/AIExplanationService";
import { LlmClient } from "@/features/ai-explanation/infrastructure/LlmClient";
import { AppError, ValidationError } from "@/shared/utils/errors";
import type {
  SupportedAiModel,
  WordLookupRequest,
  WordLookupStreamEvent,
} from "@/shared/types/api";

export const runtime = "nodejs";

const wordLookupService = new WordLookupService(
  new JapaneseDictionaryService(new JapaneseDictionaryRepository()),
  new AIExplanationService(new LlmClient())
);

const SUPPORTED_MODELS: SupportedAiModel[] = [
  "gpt-5.4",
  "gpt-5-mini",
  "gpt-5-nano",
];

const encoder = new TextEncoder();

export async function POST(request: Request) {
  try {
    let body: Partial<WordLookupRequest>;

    try {
      body = (await request.json()) as Partial<WordLookupRequest>;
    } catch {
      throw new ValidationError("request body must be valid JSON");
    }

    if (typeof body.word !== "string") {
      throw new ValidationError("word must be a string");
    }

    if (
      body.model !== undefined &&
      !SUPPORTED_MODELS.includes(body.model as SupportedAiModel)
    ) {
      throw new ValidationError(
        "model must be one of: gpt-5.4, gpt-5-mini, gpt-5-nano"
      );
    }

    const model = body.model as SupportedAiModel | undefined;
    const preview = await wordLookupService.prepareLookup(body.word);

    let isClosed = false;
    const abortController = new AbortController();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const safeWriteStreamEvent = (event: WordLookupStreamEvent) => {
          if (isClosed) {
            return false;
          }

          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
            return true;
          } catch {
            isClosed = true;
            return false;
          }
        };

        const closeStream = () => {
          if (isClosed) {
            return;
          }

          isClosed = true;
          try {
            controller.close();
          } catch {
            // The consumer may have already closed the stream.
          }
        };

        safeWriteStreamEvent({
          type: "preview",
          data: preview,
        });

        void (async () => {
          try {
            const result = await wordLookupService.completeLookup(
              preview,
              model,
              (delta) => {
                safeWriteStreamEvent({
                  type: "ai_delta",
                  data: { delta },
                });
              },
              abortController.signal
            );
            safeWriteStreamEvent({
              type: "complete",
              data: result,
            });
          } catch (error) {
            if (error instanceof AppError) {
              safeWriteStreamEvent({
                type: "error",
                data: {
                  code: error.code,
                  message: error.exposeMessage
                    ? error.message
                    : "Service temporarily unavailable",
                },
              });
            } else {
              if (
                error instanceof Error &&
                error.name === "AbortError" &&
                isClosed
              ) {
                return;
              }

              if (error instanceof Error) {
                console.error("POST /api/words/explain stream failed", error);
              }
              safeWriteStreamEvent({
                type: "error",
                data: {
                  code: "INTERNAL_ERROR",
                  message: "Internal server error",
                },
              });
            }
          } finally {
            closeStream();
          }
        })();
      },
      cancel() {
        // The browser can cancel an SSE stream while the OpenAI request is still
        // producing deltas. Treat that as a normal shutdown path.
        isClosed = true;
        abortController.abort();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.exposeMessage
              ? error.message
              : "Service temporarily unavailable",
          },
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof Error) {
      console.error("POST /api/words/explain failed", error);
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
