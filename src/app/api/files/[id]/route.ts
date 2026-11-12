// Serve the original attachment bytes; never substitute a generated document.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultStorageProvider } from "@/lib/storage";
import { incomingScope } from "@/modules/document/incoming/access";
import { buildDataScopeFilter } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const file = await prisma.documentFile.findUnique({
      where: { id },
      include: { document: { select: { direction: true } } },
    });
    if (!file) throw new BusinessError("NOT_FOUND", "Không tìm thấy tệp gốc.");
    const scope =
      file.document.direction === "INCOMING"
        ? incomingScope(ctx)
        : await buildDataScopeFilter(ctx, Permissions.OUTGOING_VIEW);
    const accessible = await prisma.document.findFirst({
      where: { AND: [{ id: file.documentId }, scope] },
      select: { id: true },
    });
    if (!accessible)
      throw new BusinessError(
        "NOT_FOUND",
        "Không tìm thấy tệp hoặc bạn không có quyền xem.",
      );
    const attachment = file;
    const buffer = await defaultStorageProvider.readFile(
      String(attachment.fileKey),
    );
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
