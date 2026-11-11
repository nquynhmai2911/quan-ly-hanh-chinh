// src/lib/storage/local-provider.ts
// Cài đặt LocalStorageProvider: Lưu file trên disk, chuẩn hóa tên file, tính SHA-256

import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { StorageProvider, StoredFileResult } from "./provider";
import { BusinessError } from "@/lib/errors";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/constants";

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.env.UPLOAD_DIR || "./uploads";
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.access(this.baseDir);
    } catch {
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }

  /** Chuẩn hóa tên file: loại bỏ ký tự lạ, chuyển tiếng Việt không dấu, chống directory traversal */
  private sanitizeFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const basename = path
      .basename(filename, ext)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .substring(0, 80);

    return `${basename}${ext}`;
  }

  async saveFile(buffer: Buffer, originalFilename: string, mimeType: string): Promise<StoredFileResult> {
    // 1. Kiểm tra kích thước
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BusinessError(
        "FILE_TOO_LARGE",
        `Dung lượng file (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) vượt quá hạn mức tối đa (${(
          MAX_FILE_SIZE_BYTES /
          (1024 * 1024)
        ).toFixed(0)}MB).`
      );
    }

    // 2. Kiểm tra MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType as typeof ALLOWED_MIME_TYPES[number])) {
      throw new BusinessError("INVALID_FILE_TYPE", `Định dạng file '${mimeType}' không được hỗ trợ.`);
    }

    await this.ensureDir();

    // 3. Tính mã băm SHA-256 của file
    const fileHash = createHash("sha256").update(buffer).digest("hex");

    // 4. Sinh tên file lưu trữ duy nhất trên disk
    const cleanName = this.sanitizeFilename(originalFilename);
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const uniqueKey = `${datePrefix}_${fileHash.slice(0, 12)}_${cleanName}`;
    const targetPath = path.join(this.baseDir, uniqueKey);

    // Lưu vào disk
    await fs.writeFile(targetPath, buffer);

    return {
      fileKey: uniqueKey,
      fileHash,
      fileSize: buffer.length,
      fileName: originalFilename,
      mimeType,
    };
  }

  async readFile(fileKey: string): Promise<Buffer> {
    const safeKey = path.basename(fileKey);
    const filePath = path.join(this.baseDir, safeKey);
    try {
      return await fs.readFile(filePath);
    } catch {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy file lưu trữ trên hệ thống.");
    }
  }

  async deleteFile(fileKey: string): Promise<void> {
    const safeKey = path.basename(fileKey);
    const filePath = path.join(this.baseDir, safeKey);
    try {
      await fs.unlink(filePath);
    } catch {
      // Bỏ qua nếu file không tồn tại
    }
  }
}

export const defaultStorageProvider = new LocalStorageProvider();
