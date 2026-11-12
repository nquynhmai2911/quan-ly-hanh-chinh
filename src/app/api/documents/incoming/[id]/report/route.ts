import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { reportResultSchema } from "@/modules/document/schema";
import { BusinessError } from "@/lib/errors";
import { reportIncoming } from "@/modules/document/incoming/workflow";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const parsed = reportResultSchema.safeParse({
      ...(await request.json()),
      documentId: id,
    });
    if (!parsed.success)
      throw new BusinessError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message,
      );
    return successResponse(
      await reportIncoming(ctx, id, parsed.data.reportContent),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
