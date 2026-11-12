import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { defaultStorageProvider } from "@/lib/storage";
import { BusinessError } from "@/lib/errors";

export async function claimUpload(
  tx: Prisma.TransactionClient,
  userId: string,
  reference: { uploadId?: string; fileKey?: string },
) {
  if (!reference.uploadId && !reference.fileKey)
    throw new BusinessError("VALIDATION_ERROR", "Tệp tải lên chưa hợp lệ.");
  const upload = await tx.pendingUpload.findFirst({
    where: {
      id: reference.uploadId,
      fileKey: reference.fileKey,
      uploaderId: userId,
      claimedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "desc" },
  });
  if (!upload)
    throw new BusinessError(
      "VALIDATION_ERROR",
      "Tệp không thuộc phiên nộp của bạn, đã dùng hoặc hết hạn. Vui lòng tải lại tệp.",
    );
  const buffer = await defaultStorageProvider.readFile(upload.fileKey);
  if (
    buffer.length !== upload.fileSize ||
    createHash("sha256").update(buffer).digest("hex") !== upload.fileHash
  )
    throw new BusinessError(
      "CONFLICT",
      "Nội dung tệp đã thay đổi. Vui lòng tải lại.",
    );
  const claimed = await tx.pendingUpload.updateMany({
    where: { id: upload.id, claimedAt: null },
    data: { claimedAt: new Date() },
  });
  if (claimed.count !== 1)
    throw new BusinessError("CONFLICT", "Tệp đã được dùng trong hồ sơ khác.");
  return {
    fileKey: upload.fileKey,
    fileName: upload.fileName,
    fileHash: upload.fileHash,
    fileSize: upload.fileSize,
    mimeType: upload.mimeType,
    uploaderId: userId,
  };
}
