import { NextResponse } from "next/server";
import { AppError } from "@/shared/utils/errors";

export function toErrorResponse(error: unknown, context: string) {
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
    console.error(context, error);
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
