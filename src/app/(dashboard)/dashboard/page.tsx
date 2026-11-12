// src/app/(dashboard)/dashboard/page.tsx
// Trung tâm Điều hành & Bàn làm việc hợp nhất (Hợp nhất Dashboard, Bàn làm việc và Báo cáo thống kê)

"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge, DocumentStatusBadge, UrgencyBadge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { toast } from "sonner";
import { processingLabels } from "@/lib/display-labels";
import type { DocumentStatus, UrgencyLevel } from "@prisma/client";
import {
  LayoutDashboard,
  CheckCircle2,
  BarChart3,
  FileText,
  Send,
  AlertTriangle,
  Clock,
  UserCheck,
  TrendingUp,
  Download,
  Plus,
  ArrowRight,
  Calendar,
  User,
  CheckCircle,
  Building2,
  Printer,
  Sparkles,
  Inbox,
  RefreshCw,
} from "lucide-react";

// Types
interface DashboardData {
  summary: {
    totalIncoming: number;
    pendingIncoming: number;
    overdueIncoming: number;
    urgentIncoming: number;
    todayIncoming: number;
    totalOutgoing: number;
    pendingOutgoing: number;
    issuedOutgoing: number;
    myHandlingCount: number;
  };
  recentDocuments: Array<{
    id: string;
    direction: "INCOMING" | "OUTGOING";
    documentNumber: string | null;
    title: string;
    status: DocumentStatus;
    urgency: UrgencyLevel;
    createdAt: string;
  }>;
}

interface TaskItem {
  id: string;
  documentId: string;
  documentNumber: string;
  documentTitle: string;
  role: string;
  instruction: string;
  assignerName: string;
  deadline: string | null;
  status: string;
  canReport: boolean;
  reportContent: string | null;
  urgency: UrgencyLevel;
  isOverdue: boolean;
  isDueSoon: boolean;
}

type MonthStat = { month: string; incoming: number; outgoing: number };
type DeptStat = { unitName: string; code: string; total: number; onTimeRate: number };
type DocTypeStat = { typeName: string; count: number; percent: number };

interface ReportData {
  summary: {
    avgOnTimeRate: number;
    totalCompleted: number;
    totalIncoming: number;
    totalOutgoing: number;
    totalOverdue: number;
  };
  monthlyStats: MonthStat[];
  deptStats: DeptStat[];
  docTypeStats: DocTypeStat[];
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Tab: "tasks" (Việc của tôi) | "overview" (Tổng quan điều hành) | "reports" (Báo cáo & Sổ văn bản)
  const initialTab = searchParams.get("tab") as "tasks" | "overview" | "reports" | null;
  const [activeTab, setActiveTab] = useState<"tasks" | "overview" | "reports">(
    initialTab || "overview",
  );

  // Sync tab with URL
  function handleTabChange(tab: "tasks" | "overview" | "reports") {
    setActiveTab(tab);
    router.replace(`/dashboard?tab=${tab}`);
  }

  // 1. Dữ liệu Tổng quan Dashboard
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);

  // 2. Dữ liệu Bàn làm việc (Tasks)
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({
    all: 0,
    pending: 0,
    inProgress: 0,
    overdue: 0,
    dueSoon: 0,
    completed: 0,
  });
  const [currentTaskFilter, setCurrentTaskFilter] = useState("ALL");
  const [isTasksLoading, setIsTasksLoading] = useState(true);

  // Drawer Nộp báo cáo
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // 3. Dữ liệu Báo cáo Thống kê (Reports)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  // Fetch Dashboard Stats
  function loadDashboardStats() {
    setIsOverviewLoading(true);
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setDashboardData(j.data);
      })
      .catch(() => toast.error("Không thể tải số liệu tổng quan."))
      .finally(() => setIsOverviewLoading(false));
  }

  // Fetch Tasks
  function loadTasks(filter = currentTaskFilter) {
    setIsTasksLoading(true);
    fetch(`/api/tasks?filter=${filter}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setTasks(j.data.tasks || []);
          setTaskCounts(j.data.counts || {});
        }
      })
      .catch(() => toast.error("Không thể tải công việc cá nhân."))
      .finally(() => setIsTasksLoading(false));
  }

  // Fetch Reports
  function loadReports(year = selectedYear) {
    setIsReportLoading(true);
    fetch(`/api/reports?year=${year}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setReportData(j.data);
      })
      .catch(() => toast.error("Không thể tải dữ liệu báo cáo."))
      .finally(() => setIsReportLoading(false));
  }

  useEffect(() => {
    loadDashboardStats();
    loadTasks();
  }, []);

  useEffect(() => {
    if (activeTab === "tasks") loadTasks(currentTaskFilter);
    if (activeTab === "reports" && !reportData) loadReports(selectedYear);
  }, [activeTab, currentTaskFilter, selectedYear]);

  // Submit Task Report
  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask) return;
    if (!reportContent || reportContent.trim().length < 5) {
      toast.error("Vui lòng nhập nội dung báo cáo tối thiểu 5 ký tự.");
      return;
    }
    try {
      setIsSubmittingReport(true);
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportContent, status: "REPORTED" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Đã gửi báo cáo kết quả xử lý thành công!");
        setIsReportOpen(false);
        loadTasks(currentTaskFilter);
        loadDashboardStats();
      } else {
        toast.error(json.error?.message || "Lỗi khi nộp báo cáo.");
      }
    } catch {
      toast.error("Lỗi kết nối máy chủ.");
    } finally {
      setIsSubmittingReport(false);
    }
  }

  function exportBook(bookType: "INCOMING" | "OUTGOING") {
    window.open(`/api/reports/export-excel?bookType=${bookType}&year=${selectedYear}`, "_blank");
    toast.success(`Đang xuất Sổ văn bản ${bookType === "INCOMING" ? "đến" : "đi"} năm ${selectedYear}...`);
  }

  return (
    <div className="space-y-5">
      {/* Top Banner & Tiêu đề */}
      <div className="bg-white rounded border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-indigo-600" />
            Trung tâm Điều hành & Bàn làm việc
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Không gian làm việc hợp nhất: Xử lý công việc được giao, theo dõi tiến độ luân chuyển và báo cáo thống kê công vụ
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link href="/documents/incoming/new">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5 text-indigo-600" /> Tiếp nhận VB đến
            </Button>
          </Link>
          <Link href="/documents/outgoing/new">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Send className="h-3.5 w-3.5 text-emerald-600" /> Tạo dự thảo VB đi
            </Button>
          </Link>
          <a href="/api/reports/export-excel" download>
            <Button size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Xuất Sổ Excel
            </Button>
          </a>
        </div>
      </div>

      {/* Thanh Tabs Chức năng Hợp nhất */}
      <div className="bg-white rounded border border-slate-200 px-3 pt-2 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1">
          {/* Tab 1: Bàn làm việc (Việc của tôi) */}
          <button
            type="button"
            onClick={() => handleTabChange("tasks")}
            className={`px-3.5 py-2.5 text-xs font-semibold rounded-t-md flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === "tasks"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <CheckCircle2 className={`h-4 w-4 ${activeTab === "tasks" ? "text-indigo-600" : "text-slate-400"}`} />
            <span>Việc của tôi (Bàn làm việc)</span>
            {taskCounts.all > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  taskCounts.overdue > 0
                    ? "bg-rose-100 text-rose-700"
                    : activeTab === "tasks"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-200 text-slate-700"
                }`}
              >
                {taskCounts.all}
              </span>
            )}
          </button>

          {/* Tab 2: Tổng quan điều hành */}
          <button
            type="button"
            onClick={() => handleTabChange("overview")}
            className={`px-3.5 py-2.5 text-xs font-semibold rounded-t-md flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === "overview"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <LayoutDashboard className={`h-4 w-4 ${activeTab === "overview" ? "text-indigo-600" : "text-slate-400"}`} />
            <span>Tổng quan điều hành</span>
          </button>

          {/* Tab 3: Báo cáo & Sổ văn bản */}
          <button
            type="button"
            onClick={() => handleTabChange("reports")}
            className={`px-3.5 py-2.5 text-xs font-semibold rounded-t-md flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === "reports"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <BarChart3 className={`h-4 w-4 ${activeTab === "reports" ? "text-indigo-600" : "text-slate-400"}`} />
            <span>Báo cáo & Sổ văn bản</span>
          </button>
        </div>

        {/* Nút làm mới */}
        <button
          type="button"
          onClick={() => {
            if (activeTab === "tasks") loadTasks(currentTaskFilter);
            else if (activeTab === "overview") loadDashboardStats();
            else loadReports(selectedYear);
            toast.success("Đã làm mới dữ liệu.");
          }}
          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          title="Làm mới dữ liệu"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* NỘI DUNG TAB 1: VIỆC CỦA TÔI (BÀN LÀM VIỆC) */}
      {/* ========================================================================= */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          {/* Bộ lọc trạng thái công việc */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-white p-2 rounded border border-slate-200 text-xs">
            {[
              { key: "ALL", label: "Tất cả", count: taskCounts.all },
              { key: "IN_PROGRESS", label: "Đang thực hiện", count: taskCounts.inProgress },
              { key: "DUE_SOON", label: "Sắp đến hạn", count: taskCounts.dueSoon, badgeClass: "bg-amber-100 text-amber-800" },
              { key: "OVERDUE", label: "Quá hạn", count: taskCounts.overdue, badgeClass: "bg-rose-100 text-rose-800" },
              { key: "COMPLETED", label: "Đã hoàn thành", count: taskCounts.completed, badgeClass: "bg-emerald-100 text-emerald-800" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCurrentTaskFilter(tab.key)}
                className={`px-3 py-1.5 font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentTaskFilter === tab.key
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    tab.badgeClass ||
                    (currentTaskFilter === tab.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")
                  }`}
                >
                  {tab.count || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Danh sách nhiệm vụ */}
          {isTasksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-white rounded border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-white rounded border border-slate-200 p-12 text-center space-y-3 shadow-2xs">
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
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono">
                        Số: {task.documentNumber || "Chưa cấp số"}
                      </span>
                      <Badge
                        variant={
                          task.role === "MAIN"
                            ? "default"
                            : task.role === "COORDINATE"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {task.role === "MAIN"
                          ? "Chủ trì xử lý"
                          : task.role === "COORDINATE"
                            ? "Phối hợp"
                            : "Nhận để biết"}
                      </Badge>
                      <UrgencyBadge level={task.urgency} />
                      {task.isOverdue && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                          Đã quá hạn
                        </span>
                      )}
                      {task.isDueSoon && !task.isOverdue && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                          Sắp đến hạn
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {task.canReport && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTask(task);
                            setReportContent(task.reportContent || "");
                            setIsReportOpen(true);
                          }}
                          className="text-xs text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100"
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" /> Nộp báo cáo
                        </Button>
                      )}
                      <Link href={`/documents/${task.documentId}`}>
                        <Button variant="primary" size="sm" className="text-xs gap-1">
                          Xem hồ sơ <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <div>
                    <Link
                      href={`/documents/${task.documentId}`}
                      className="text-sm font-bold text-slate-900 hover:text-indigo-600 line-clamp-1"
                    >
                      {task.documentTitle}
                    </Link>
                    {task.instruction && (
                      <div className="text-xs text-slate-600 mt-1.5 bg-slate-50 p-2.5 rounded border border-slate-100">
                        <span className="font-semibold text-slate-700 mr-1.5">Nhiệm vụ:</span>
                        <span className="italic text-slate-800">&ldquo;{task.instruction}&rdquo;</span>
                      </div>
                    )}
                    {task.reportContent && (
                      <div className="text-xs text-emerald-950 mt-1.5 bg-emerald-50/70 p-2.5 rounded border border-emerald-200">
                        <strong className="text-emerald-900 uppercase text-[10px] block mb-0.5">Báo cáo của bạn:</strong>
                        <p className="whitespace-pre-wrap">{task.reportContent}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        Người giao: <strong className="text-slate-700">{task.assignerName}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        Hạn xử lý:{" "}
                        <strong className={task.isOverdue ? "text-rose-600" : "text-slate-700"}>
                          {task.deadline ? new Date(task.deadline).toLocaleDateString("vi-VN") : "Theo quy chế chung"}
                        </strong>
                      </span>
                    </div>
                    <div className="font-semibold text-slate-700">
                      {processingLabels[task.status] || "Chờ xử lý"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Drawer nộp báo cáo kết quả */}
          <Drawer
            isOpen={isReportOpen}
            onClose={() => setIsReportOpen(false)}
            title="Báo cáo tiến độ & Kết quả xử lý công việc"
            description={`Văn bản: ${selectedTask?.documentNumber || ""} - ${selectedTask?.documentTitle || ""}`}
          >
            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800 uppercase text-[10px]">Nhiệm vụ được giao:</div>
                <p className="text-slate-700 italic">&ldquo;{selectedTask?.instruction}&rdquo;</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Gợi ý nhanh:
                </span>
                <div className="flex flex-col gap-1.5">
                  {[
                    "Đã xác minh đầy đủ hồ sơ của công dân, thông tin chính xác và đủ điều kiện phê duyệt.",
                    "Đã hoàn thành dự thảo văn bản trả lời, kính trình Lãnh đạo xem xét ký duyệt.",
                    "Hồ sơ cần bổ sung giấy tờ xác minh nhân thân, đã thông báo cho người nộp đơn.",
                  ].map((hint, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReportContent(hint)}
                      className="text-left text-xs bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 border border-slate-200 rounded px-2.5 py-1.5 transition-colors cursor-pointer"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nội dung báo cáo kết quả / Ý kiến đề xuất *
                </label>
                <textarea
                  required
                  rows={5}
                  value={reportContent}
                  onChange={(e) => setReportContent(e.target.value)}
                  placeholder="Nhập chi tiết các nội dung đã xử lý, kết quả thẩm tra hoặc chọn mẫu gợi ý bên trên..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsReportOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" isLoading={isSubmittingReport} className="gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Gửi báo cáo
                </Button>
              </div>
            </form>
          </Drawer>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NỘI DUNG TAB 2: TỔNG QUAN ĐIỀU HÀNH */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Lưới 4 Thẻ KPI chính */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Việc của tôi */}
            <div
              onClick={() => handleTabChange("tasks")}
              className="bg-white rounded border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Việc tôi phải xử lý</span>
                <div className="p-2 rounded bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <UserCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-indigo-700">
                  {isOverviewLoading ? "..." : dashboardData?.summary.myHandlingCount || 0}
                </span>
                <span className="text-xs text-slate-400">hồ sơ cần thụ lý</span>
              </div>
              <span className="text-[11px] text-indigo-600 font-medium group-hover:underline mt-3 inline-flex items-center gap-1">
                Vào bàn làm việc <ArrowRight className="h-3 w-3" />
              </span>
            </div>

            {/* Văn bản đến đang xử lý */}
            <Link
              href="/documents/incoming"
              className="bg-white rounded border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">VB Đến đang xử lý</span>
                <div className="p-2 rounded bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <FileText className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-700">
                  {isOverviewLoading ? "..." : dashboardData?.summary.pendingIncoming || 0}
                </span>
                <span className="text-xs text-slate-400">/ tổng {dashboardData?.summary.totalIncoming || 0}</span>
              </div>
              <span className="text-[11px] text-amber-600 font-medium group-hover:underline mt-3 inline-flex items-center gap-1">
                Theo dõi tiến độ <ArrowRight className="h-3 w-3" />
              </span>
            </Link>

            {/* Cảnh báo quá hạn */}
            <div className="bg-white rounded border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Cảnh báo quá hạn</span>
                <div className="p-2 rounded bg-rose-50 text-rose-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-rose-600">
                  {isOverviewLoading ? "..." : dashboardData?.summary.overdueIncoming || 0}
                </span>
                <span className="text-xs text-slate-400">văn bản trễ hạn</span>
              </div>
              <div className="text-[11px] text-rose-500 font-medium mt-3 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Cần đôn đốc khẩn cấp
              </div>
            </div>

            {/* Văn bản đi đã ban hành */}
            <Link
              href="/documents/outgoing"
              className="bg-white rounded border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">VB Đi đã ban hành</span>
                <div className="p-2 rounded bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Send className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-700">
                  {isOverviewLoading ? "..." : dashboardData?.summary.issuedOutgoing || 0}
                </span>
                <span className="text-xs text-slate-400">/ tổng {dashboardData?.summary.totalOutgoing || 0}</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-medium group-hover:underline mt-3 inline-flex items-center gap-1">
                Xem sổ văn bản đi <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>

          {/* Bảng văn bản luân chuyển gần đây */}
          <div className="bg-white rounded border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
                Văn bản luân chuyển mới nhất
              </h2>
              <Link href="/documents/incoming" className="text-xs text-indigo-600 hover:underline">
                Xem tất cả &rarr;
              </Link>
            </div>

            {isOverviewLoading ? (
              <p className="text-xs text-slate-400 text-center py-6">Đang tải dữ liệu...</p>
            ) : dashboardData?.recentDocuments.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Chưa có văn bản nào trong hệ thống.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {dashboardData?.recentDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 px-2 rounded cursor-pointer transition-colors block"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded shrink-0 ${
                          doc.direction === "INCOMING" ? "bg-sky-50 text-sky-600" : "bg-indigo-50 text-indigo-600"
                        }`}
                      >
                        {doc.direction === "INCOMING" ? <FileText className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                      </div>
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {doc.documentNumber || "Chưa cấp số"}
                        </span>
                        <p className="text-xs font-medium text-slate-900 line-clamp-1 mt-0.5">{doc.title}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <UrgencyBadge level={doc.urgency} />
                      <DocumentStatusBadge status={doc.status} />
                      <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                        {new Date(doc.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NỘI DUNG TAB 3: BÁO CÁO & SỔ VĂN BẢN */}
      {/* ========================================================================= */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          {/* Thanh công cụ báo cáo */}
          <div className="bg-white rounded border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Năm báo cáo:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                <option value="2026">Năm 2026</option>
                <option value="2025">Năm 2025</option>
                <option value="2024">Năm 2024</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => exportBook("INCOMING")} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5 text-indigo-600" /> Xuất Sổ VB Đến
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportBook("OUTGOING")} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5 text-emerald-600" /> Xuất Sổ VB Đi
              </Button>
              <Button size="sm" onClick={() => window.print()} className="gap-1.5 text-xs">
                <Printer className="h-3.5 w-3.5" /> In Báo cáo
              </Button>
            </div>
          </div>

          {/* 5 Thẻ tóm tắt báo cáo */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Tổng VB Đến</span>
              <div className="text-xl font-bold text-indigo-700 mt-1">
                {isReportLoading ? "..." : reportData?.summary.totalIncoming || 0}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Đã vào sổ tiếp nhận</span>
            </div>

            <div className="bg-white rounded border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Tổng VB Đi</span>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {isReportLoading ? "..." : reportData?.summary.totalOutgoing || 0}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Đã soạn & ban hành</span>
            </div>

            <div className="bg-white rounded border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Đã hoàn thành</span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {isReportLoading ? "..." : reportData?.summary.totalCompleted || 0}
              </div>
              <span className="text-[10px] text-emerald-600 mt-1 block">Đạt kết quả nghiệm thu</span>
            </div>

            <div className="bg-white rounded border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Tỷ lệ đúng hạn</span>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {isReportLoading ? "..." : `${reportData?.summary.avgOnTimeRate || 100}%`}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Chỉ tiêu cơ quan: &ge; 90%</span>
            </div>

            <div className="bg-white rounded border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Văn bản quá hạn</span>
              <div className="text-xl font-bold text-rose-600 mt-1">
                {isReportLoading ? "..." : reportData?.summary.totalOverdue || 0}
              </div>
              <span className="text-[10px] text-rose-500 mt-1 block">Cần đôn đốc xử lý gấp</span>
            </div>
          </div>

          {/* Biểu đồ số lượng văn bản luân chuyển 12 tháng */}
          <div className="bg-white rounded border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-indigo-600" /> Biểu đồ văn bản luân chuyển 12 tháng năm {selectedYear}
              </span>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="h-3 w-3 rounded-xs bg-indigo-600 inline-block" /> VB Đến
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="h-3 w-3 rounded-xs bg-emerald-500 inline-block" /> VB Đi
                </span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 h-44 items-end pt-4 pb-2 border-b border-slate-200">
              {(reportData?.monthlyStats || []).map((m: MonthStat, idx: number) => {
                const maxVal = 100;
                const incHeight = Math.min(100, Math.round((m.incoming / maxVal) * 100));
                const outHeight = Math.min(100, Math.round((m.outgoing / maxVal) * 100));
                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1 h-32">
                      <div
                        className="w-1/2 bg-indigo-600 rounded-t transition-all hover:bg-indigo-700 relative group/bar"
                        style={{ height: `${incHeight}%` }}
                      >
                        <span className="opacity-0 group-hover/bar:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                          Đến: {m.incoming}
                        </span>
                      </div>
                      <div
                        className="w-1/2 bg-emerald-500 rounded-t transition-all hover:bg-emerald-600 relative group/bar"
                        style={{ height: `${outHeight}%` }}
                      >
                        <span className="opacity-0 group-hover/bar:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                          Đi: {m.outgoing}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 mt-2">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lưới 2 cột: Kết quả phòng ban & Cơ cấu loại văn bản */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded border border-slate-200 p-5 shadow-2xs space-y-4">
              <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <Building2 className="h-4 w-4 text-indigo-600" /> Kết quả xử lý theo đơn vị / phòng ban
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Đơn vị / Phòng ban</th>
                      <th className="px-3 py-2.5 text-center">Tổng nhiệm vụ</th>
                      <th className="px-3 py-2.5">Tỷ lệ đúng hạn</th>
                      <th className="px-3 py-2.5 text-right">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(reportData?.deptStats || []).map((dept: DeptStat, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {dept.unitName} ({dept.code})
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">{dept.total}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${dept.onTimeRate}%` }} />
                            </div>
                            <span className="font-semibold text-slate-700">{dept.onTimeRate}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              dept.onTimeRate >= 90 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {dept.onTimeRate >= 90 ? "Tốt" : "Cần cải thiện"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded border border-slate-200 p-5 shadow-2xs space-y-4">
              <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <FileText className="h-4 w-4 text-indigo-600" /> Cơ cấu loại văn bản
              </span>
              <div className="space-y-3">
                {(reportData?.docTypeStats || []).map((type: DocTypeStat, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-800">{type.typeName}</span>
                      <span className="font-semibold text-slate-600">
                        {type.count} ({type.percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${type.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 flex items-center justify-center text-xs text-slate-500 animate-pulse">
          Đang tải trung tâm điều hành...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
