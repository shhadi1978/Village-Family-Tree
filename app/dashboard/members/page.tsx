"use client";

import Link from "next/link";
import { usePermissions } from "@/lib/hooks/use-permissions";

export default function MembersIndexPage() {
  const { canManageAnyFamily, loading } = usePermissions();

  if (loading) {
    return <div className="text-slate-400">جاري التحقق من الصلاحيات...</div>;
  }

  if (!canManageAnyFamily) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">الأفراد</h1>
          <p className="text-slate-300">
            هذا القسم مخصص لتعديل بيانات الأفراد، وهو متاح فقط لمديري العائلات.
          </p>
        </div>

        <Link
          href="/dashboard/families"
          className="inline-flex bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          العودة إلى العائلات
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">الأفراد</h1>
        <p className="text-slate-300">
          تعديل بيانات الأفراد يتم من داخل صفحة كل عائلة، لأن كل فرد يجب أن ينتمي إلى عائلة.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/families"
          className="bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg p-6 transition"
        >
          <h2 className="text-lg font-semibold text-white mb-2">عرض العائلات</h2>
          <p className="text-slate-400 text-sm">
            اختر عائلة ثم أضف أو عدّل الأفراد داخلها.
          </p>
        </Link>

        <Link
          href="/dashboard/members/new"
          className="bg-blue-600 hover:bg-blue-700 rounded-lg p-6 transition"
        >
          <h2 className="text-lg font-semibold text-white mb-2">إضافة فرد جديد</h2>
          <p className="text-blue-100 text-sm">
            انتقل لنموذج إضافة فرد.
          </p>
        </Link>
      </div>
    </div>
  );
}
