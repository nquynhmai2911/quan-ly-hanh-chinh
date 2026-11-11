// src/app/(dashboard)/notifications/page.tsx
// Màn hình Trung tâm thông báo & Nhắc việc tập trung

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  CheckCheck,
  Flame,
  ArrowRight,
  Inbox,
  Send,
} from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentTab, setCurrentTab] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  async function loadNotifications(filter = currentTab) {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/notifications?filter=${filter}`);
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data.notifications || []);
        setUnreadCount(json.data.unreadCount || 0);
      }
    } catch {
      toast.error("Không thể tải thông báo.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications(currentTab);
  }, [currentTab]);

  async function handleMarkAllAsRead() {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Đã đánh dấu tất cả thông báo là đã đọc!");
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch {
      toast.error("Lỗi khi cập nhật.");
    }
  }

  async function handleMarkAsRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }

  function getNotifIcon(type: string) {
    switch (type) {
      case "TASK_ASSIGNED":
        return <Inbox className="h-5 w-5 text-indigo-600" />;
      case "URGENT_DOCUMENT":
        return <Flame className="h-5 w-5 text-rose-600" />;
      case "DOCUMENT_APPROVED":
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case "DEADLINE_WARNING":
        return <Clock className="h-5 w-5 text-amber-600" />;
      default:
        return <Bell className="h-5 w-5 text-sky-600" />;
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-indigo-600" />
            Trung tâm thông báo & Nhắc việc
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cập nhật tức thời các văn bản mới được phân công, ý kiến chỉ đạo, phê duyệt và cảnh báo hạn xử lý
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} className="gap-1.5 text-xs">
              <CheckCheck className="h-4 w-4 text-indigo-600" /> Đánh dấu tất cả đã đọc
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { key: "ALL", label: "Tất cả", count: notifications.length },
          { key: "UNREAD", label: "Chưa đọc", count: unreadCount, badgeClass: "bg-indigo-100 text-indigo-800" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setCurrentTab(tab.key)}
            className={`px-3 py-2 text-xs font-semibold rounded-t flex items-center gap-1.5 transition-colors border-b-2 ${
              currentTab === tab.key
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {tab.label}
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                tab.badgeClass || (currentTab === tab.key ? "bg-indigo-200 text-indigo-900" : "bg-slate-200 text-slate-700")
              }`}
            >
              {tab.count || 0}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white rounded border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded border border-slate-200 p-12 text-center space-y-2">
          <Bell className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Không có thông báo mới nào</p>
          <p className="text-xs text-slate-400">Bạn đã cập nhật và theo dõi toàn bộ thông báo hệ thống.</p>
        </div>
      ) : (
        <div className="bg-white rounded border border-slate-200 divide-y divide-slate-100 shadow-xs overflow-hidden">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleMarkAsRead(notif.id)}
              className={`p-4 flex items-start justify-between gap-4 transition-colors hover:bg-slate-50/80 ${
                !notif.isRead ? "bg-indigo-50/25" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 shrink-0 mt-0.5">
                  {getNotifIcon(notif.type)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-xs ${!notif.isRead ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                      {notif.title}
                    </h4>
                    {!notif.isRead && (
                      <span className="h-2 w-2 rounded-full bg-indigo-600 inline-block" />
                    )}
                  </div>

                  <p className="text-xs text-slate-600">{notif.content}</p>

                  <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-0.5">
                    <Clock className="h-3 w-3" />
                    {new Date(notif.createdAt).toLocaleDateString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>

              {notif.link && (
                <Link href={notif.link} className="shrink-0">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                    Xem ngay <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
