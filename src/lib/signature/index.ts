import { prisma } from "@/lib/prisma";
import { SignatureType, Prisma } from "@prisma/client";
import { BusinessError } from "@/lib/errors";

export interface SignatureData {
  documentId: string;
  fileId: string;
  signerId: string;
  fileHash: string;
  certificateInfo?: Prisma.InputJsonValue;
  signatureType?: SignatureType;
}

export interface SignatureProvider {
  signDocument(data: SignatureData): Promise<{ signatureId: string; signedAt: Date }>;
  verifySignature(signatureId: string): Promise<boolean>;
}

export class ApprovalSignatureProvider implements SignatureProvider {
  async signDocument(data: SignatureData): Promise<{ signatureId: string; signedAt: Date }> {
    const { documentId, fileId, signerId, fileHash, certificateInfo, signatureType = "ELECTRONIC_APPROVAL" } = data;

    // Kiểm tra file có đúng hash hiện tại không
    const file = await prisma.documentFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy file để thực hiện phê duyệt điện tử.");
    }

    if (file.fileHash !== fileHash) {
      throw new BusinessError(
        "CONFLICT",
        "Mã băm file không khớp. File có thể đã bị sửa đổi trước khi ký."
      );
    }

    const signedAt = new Date();

    const signature = await prisma.documentSignature.create({
      data: {
        documentId,
        fileId,
        signerId,
        signatureType,
        fileHash,
        certificateInfo: certificateInfo || {
          approvedBySigner: true,
          method: "ELECTRONIC_APPROVAL",
          signedTimestamp: signedAt.toISOString(),
        },
        signedAt,
      },
    });

    return { signatureId: signature.id, signedAt };
  }

  async verifySignature(signatureId: string): Promise<boolean> {
    const sig = await prisma.documentSignature.findUnique({
      where: { id: signatureId },
      include: { file: true },
    });

    if (!sig || !sig.file) return false;
    return sig.fileHash === sig.file.fileHash;
  }
}

export const defaultSignatureProvider = new ApprovalSignatureProvider();
