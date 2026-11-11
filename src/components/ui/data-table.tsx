// src/components/ui/data-table.tsx
// DataTable dùng chung toàn hệ thống: TanStack Table v8, server-side pagination, sticky header, debounce search

"use client";

import React, { useState, useEffect } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown } from "lucide-react";
import { Button } from "./button";
import { TableSkeleton } from "./skeleton";
import { EmptyState } from "./empty-state";
import { SEARCH_DEBOUNCE_MS, PAGE_SIZE_OPTIONS } from "@/lib/constants";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
  onSearchChange?: (keyword: string) => void;
  onSortChange?: (sortField: string, sortOrder: "asc" | "desc") => void;
  searchPlaceholder?: string;
  onRowClick?: (row: TData) => void;
  actions?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  total = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onSortChange,
  searchPlaceholder = "Tìm kiếm nhanh theo số, ký hiệu, trích yếu...",
  onRowClick,
  actions,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Debounce tìm kiếm 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(searchTerm);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm, onSearchChange]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const nextSorting = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(nextSorting);
      if (onSortChange && nextSorting.length > 0) {
        onSortChange(nextSorting[0].id, nextSorting[0].desc ? "desc" : "asc");
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="w-full flex flex-col bg-white rounded border border-slate-200 shadow-xs">
      {/* Thanh công cụ: Tìm kiếm & Thao tác */}
      <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-50/50">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3.5 py-1.5 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
          />
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Vùng Bảng với Sticky Header */}
      <div className="relative overflow-x-auto min-h-[300px]">
        {isLoading ? (
          <TableSkeleton rows={pageSize > 10 ? 10 : pageSize} cols={columns.length} />
        ) : data.length === 0 ? (
          <div className="py-12">
            <EmptyState />
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-700 border-collapse">
            <thead className="bg-slate-100/80 sticky top-0 z-10 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 select-none">
                      {header.isPlaceholder ? null : (
                        <div
                          className={
                            header.column.getCanSort()
                              ? "flex items-center gap-1.5 cursor-pointer hover:text-slate-900"
                              : ""
                          }
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick && onRowClick(row.original)}
                  className={`transition-colors hover:bg-slate-50/80 ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Phân trang (Pagination footer) */}
      <div className="px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span>Hiển thị</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange && onPageSizeChange(Number(e.target.value))}
            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-600 outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} dòng
              </option>
            ))}
          </select>
          <span>/ tổng số {total.toLocaleString("vi-VN")} bản ghi</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span>
            Trang {page} / {totalPages}
          </span>
          <div className="flex items-center gap-0.5 ml-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange && onPageChange(1)}
              disabled={page <= 1 || isLoading}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange && onPageChange(page - 1)}
              disabled={page <= 1 || isLoading}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange && onPageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange && onPageChange(totalPages)}
              disabled={page >= totalPages || isLoading}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
