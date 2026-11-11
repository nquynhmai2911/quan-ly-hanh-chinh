// src/lib/errors.ts
// Lỗi nghiệp vụ chuẩn hóa — dùng chung cả server và client

/** Mã lỗi nghiệp vụ */
export type BusinessErrorCode =
  | "INVALID_TRANSITION"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "INTERNAL_ERROR";

/** Thông điệp lỗi mặc định tiếng Việt */
export const ERROR_MESSAGES: Record<BusinessErrorCode, string> = {
  INVALID_TRANSITION: "Chuyển trạng thái không hợp lệ.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu.",
  CONFLICT: "Dữ liệu đã tồn tại hoặc bị trùng lặp.",
  VALIDATION_ERROR: "Dữ liệu không hợp lệ.",
  UNAUTHORIZED: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.",
  FILE_TOO_LARGE: "File vượt quá dung lượng cho phép.",
  INVALID_FILE_TYPE: "Định dạng file không được hỗ trợ.",
  INTERNAL_ERROR: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
};

/** Lỗi nghiệp vụ — throw trong Service, bắt ở Route Handler */
export class BusinessError extends Error {
  public readonly code: BusinessErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: BusinessErrorCode,
    message?: string,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message || ERROR_MESSAGES[code]);
    this.name = "BusinessError";
    this.code = code;
    this.statusCode = statusCode || BusinessError.defaultStatusCode(code);
    this.details = details;
  }

  private static defaultStatusCode(code: BusinessErrorCode): number {
    switch (code) {
      case "UNAUTHORIZED":
        return 401;
      case "FORBIDDEN":
        return 403;
      case "NOT_FOUND":
        return 404;
      case "CONFLICT":
        return 409;
      case "VALIDATION_ERROR":
      case "INVALID_TRANSITION":
      case "FILE_TOO_LARGE":
      case "INVALID_FILE_TYPE":
        return 400;
      default:
        return 500;
    }
  }

  /** Serialize cho JSON response */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}
