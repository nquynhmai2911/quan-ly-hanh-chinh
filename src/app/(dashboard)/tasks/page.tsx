// src/app/(dashboard)/tasks/page.tsx
// Trang Bàn làm việc & Quản lý Công việc cá nhân được giao

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Badge, UrgencyBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  User,
  ArrowRight,
  Send,
  Flame,
  CheckCircle,
  Filter,
} from "lucide-react";

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({ all: 0, pending: 0, inProgress: 0, overdue: 0, dueSoon: 0, completed: 0 });
  const [currentFilter, setCurrentFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Drawer nộp báo cáo
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadTasks(filter = currentFilter) {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/tasks?filter=${filter}`);
      const json = await res.json();
      if (json.success) {
        setTasks(json.data.tasks || []);
        setCounts(json.data.counts || {});
      }
    } catch {
      toast.error("Không thể tải danh sách công việc.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTasks(currentFilter);
  }, [currentFilter]);

  function handleOpenReport(task: any) {
    setSelectedTask(task);
    setReportContent(task.reportContent || "");
    setIsReportOpen(true);
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportContent || reportContent.trim().length < 5) {
      toast.error("Vui lòng nhập nội dung báo cáo tối thiểu 5 ký tự.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportContent, status: "REPORTED" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Đã gửi báo cáo kết quả xử lý thành công!");
        setIsReportOpen(false);
        loadTasks(currentFilter);
      } else {
        toast.error(json.error?.message || "Lỗi khi nộp báo cáo.");
      }
    } catch {
      toast.error("Lỗi kết nối máy chủ.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-indigo-600" />
            Công việc được giao & Bàn làm việc
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi danh sách văn bản và nhiệm vụ bạn được phân công xử lý chính, phối hợp hoặc nhận để biết
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadTasks(currentFilter)}>
            Làm mới danh sách
          </Button>
        </div>
      </div>

      {/* Tabs lọc trạng thái */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { key: "ALL", label: "Tất cả", count: counts.all },
          { key: "IN_PROGRESS", label: "Đang thực hiện", count: counts.inProgress },
          { key: "DUE_SOON", label: "Sắp đến hạn", count: counts.dueSoon, badgeClass: "bg-amber-100 text-amber-800" },
          { key: "OVERDUE", label: "Quá hạn", count: counts.overdue, badgeClass: "bg-rose-100 text-rose-800" },
          { key: "COMPLETED", label: "Đã hoàn thành", count: counts.completed, badgeClass: "bg-emerald-100 text-emerald-800" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setCurrentFilter(tab.key)}
            className={`px-3 py-2 text-xs font-semibold rounded-t flex items-center gap-1.5 transition-colors border-b-2 ${
              currentFilter === tab.key
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {tab.label}
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                tab.badgeClass || (currentFilter === tab.key ? "bg-indigo-200 text-indigo-900" : "bg-slate-200 text-slate-700")
              }`}
            >
              {tab.count || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white rounded border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded border border-slate-200 p-12 text-center space-y-3">
          <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">Không có công việc nào trong mục này</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Hiện bạn không có công việc hoặc văn bản nào cần xử lý với bộ lọc đã chọn.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`bg-white rounded border transition-all hover:shadow-xs p-4 space-y-3 ${
                task.isOverdue
                  ? "border-rose-300 bg-rose-50/20"
                  : task.isDueSoon
                  ? "border-amber-300 bg-amber-50/20"
                  : "border-slate-200"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Số: {task.documentNumber}
                  </span>

                  <Badge variant={task.role === "MAIN" ? "default" : task.role === "COORDINATE" ? "secondary" : "outline"}>
                    {task.role === "MAIN" ? "Chủ trì xử lý" : task.role === "COORDINATE" ? "Phối hợp" : "Nhận để biết"}
                  </Badge>

                  <UrgencyBadge level={task.urgency} />

                  {task.isOverdue && (
                    <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      QUÁ HẠN
                    </span>
                  )}

                  {task.isDueSoon && !task.isOverdue && (
                    <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      SẮP ĐẾN HẠN
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenReport(task)}>
                    Báo cáo kết quả
                  </Button>
                  <Link href={`/documents/${task.documentId}`}>
                    <Button variant="primary" size="sm" className="gap-1">
                      Xem văn bản <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Title & Instruction */}
              <div>
                <Link
                  href={`/documents/${task.documentId}`}
                  className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors line-clamp-2"
                >
                  {task.documentTitle}
                </Link>
                <div className="mt-1 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100 flex items-start gap-2">
                  <span className="font-semibold text-slate-800 shrink-0">Ý kiến chỉ đạo:</span>
                  <span className="italic">"{task.instruction}"</span>
                </div>
              </div>

              {/* Progress & Metadata */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    Người giao: <strong className="text-slate-700">{task.assignerName}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Hạn xử lý:{" "}
                    <strong className={task.isOverdue ? "text-rose-600" : "text-slate-700"}>
                      {task.deadline ? new Date(task.deadline).toLocaleDateString("vi-VN") : "Không thời hạn"}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-48">
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        task.progressPercent >= 100
                          ? "bg-emerald-500"
                          : task.progressPercent >= 60
                          ? "bg-indigo-600"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${task.progressPercent}%` }}
                    />
                  </div>
                  <span className="font-bold text-[11px] text-slate-700 shrink-0">{task.progressPercent}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer Nộp báo cáo kết quả */}
      <Drawer
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title="Báo cáo tiến độ & Kết quả xử lý công việc"
        description={`Văn bản: ${selectedTask?.documentNumber || ""} - ${selectedTask?.documentTitle || ""}`}
      >
        <div className="space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5">
            <div className="font-semibold text-slate-800">Nhiệm vụ được giao:</div>
            <p className="text-slate-600 italic">"{selectedTask?.instruction}"</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nội dung báo cáo kết quả / Tiến độ chi tiết *
            </label>
            <textarea
              rows={6}
              value={reportContent}
              onChange={(e) => setReportContent(e.target.value)}
              placeholder="Nhập chi tiết các công việc đã thực hiện, kết quả đạt được, hoặc các vướng mắc cần xin ý kiến chỉ đạo..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Báo cáo này sẽ được chuyển tới Lãnh đạo/Trưởng phòng để nghiệm thu và xác nhận hoàn thành văn bản.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsReportOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSubmitReport} isLoading={isSubmitting} className="gap-1.5">
              <Send className="h-3.5 w-3.5" /> Gửi báo cáo
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
