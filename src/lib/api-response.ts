// src/lib/api-response.ts
// Chuẩn hóa response cho Route Handlers

import { NextResponse } from "next/server";
import { BusinessError } from "./errors";

/** Response thành công */
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/** Response thành công có phân trang */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  }
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.pageSize),
    },
  });
}

/** Response lỗi */
export function errorResponse(error: unknown) {
  if (error instanceof BusinessError) {
    return NextResponse.json(
      { success: false, error: error.toJSON() },
      { status: error.statusCode }
    );
  }

  console.error("[API Error]", error);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
      },
    },
    { status: 500 }
  );
}
