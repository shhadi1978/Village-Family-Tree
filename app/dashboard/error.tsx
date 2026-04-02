"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard render error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 p-6 md:p-10">
      <div className="mx-auto max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">
        <h2 className="mb-2 text-2xl font-bold">حدث خطأ في تحميل لوحة التحكم</h2>
        <p className="mb-4 text-sm text-red-200">
          يرجى التأكد من إعداد متغيرات البيئة وقاعدة البيانات في Vercel ثم أعد المحاولة.
        </p>
        {error?.digest ? (
          <p className="mb-4 text-xs text-red-300">Digest: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
