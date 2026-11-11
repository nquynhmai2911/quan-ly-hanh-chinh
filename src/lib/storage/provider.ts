// src/lib/storage/provider.ts
// Interface trừu tượng hóa dịch vụ lưu trữ file (StorageProvider)

export interface StoredFileResult {
  fileKey: string;      // Định danh hoặc đường dẫn lưu file
  fileHash: string;     // Mã băm SHA-256 của file
  fileSize: number;     // Kích thước file (bytes)
  fileName: string;     // Tên file đã chuẩn hóa
  mimeType: string;     // MIME type thực của file
}

export interface StorageProvider {
  /** Lưu file và trả về thông tin đã lưu kèm SHA-256 */
  saveFile(buffer: Buffer, originalFilename: string, mimeType: string): Promise<StoredFileResult>;

  /** Đọc file từ bộ lưu trữ */
  readFile(fileKey: string): Promise<Buffer>;

  /** Xóa file khỏi bộ lưu trữ */
  deleteFile(fileKey: string): Promise<void>;
}
