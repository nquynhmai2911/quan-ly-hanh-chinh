// src/types/api.ts
// Kiểu dữ liệu chung cho API request/response

/** Response chuẩn */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Response có phân trang */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** Params phân trang / sắp xếp / lọc chung */
export interface ListParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  [key: string]: unknown;
}
