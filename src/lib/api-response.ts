// src/lib/api-response.ts
// Chuẩn hóa response cho Route Handlers

import { NextResponse } from "next/server";
import { BusinessError } from "./errors";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

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
  },
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
      { status: error.statusCode },
    );
  }

  // Xử lý lỗi Zod Validation
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const message = firstIssue?.message || "Dữ liệu gửi lên không hợp lệ.";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message,
          details: { issues: error.issues },
        },
      },
      { status: 400 },
    );
  }

  // Xử lý lỗi Prisma Database
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.warn(`[Prisma Known Error ${error.code}]`, error.message);
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "dữ liệu";
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message: `Giá trị '${target}' đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.`,
          },
        },
        { status: 409 },
      );
    }

    if (error.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message: "Không thể hoàn thành thao tác do bản ghi đang được liên kết với dữ liệu khác trong hệ thống.",
          },
        },
        { status: 409 },
      );
    }

    if (error.code === "P2025") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Bản ghi yêu cầu không tồn tại hoặc đã bị xóa.",
          },
        },
        { status: 404 },
      );
    }

    if (error.code === "P2000" || error.code === "P2006") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Dữ liệu trường nhập vào vượt quá độ dài hoặc không đúng kiểu.",
          },
        },
        { status: 400 },
      );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    console.warn("[Prisma Validation Error]", error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Tham số dữ liệu truy vấn không hợp lệ.",
        },
      },
      { status: 400 },
    );
  }

  // Xử lý lỗi cú pháp JSON payload
  if (error instanceof SyntaxError && "message" in error && error.message.includes("JSON")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu gửi lên không đúng định dạng JSON.",
        },
      },
      { status: 400 },
    );
  }

  console.error("[API Unhandled Error]", error);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
      },
    },
    { status: 500 },
  );
}
