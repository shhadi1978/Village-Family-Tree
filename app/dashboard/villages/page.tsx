"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Home, Users, ChevronLeft, Loader2 } from "lucide-react";
import { formatNumberAr } from "@/lib/i18n/format";
import { usePermissions } from "@/lib/hooks/use-permissions";

type Village = {
  id: string;
  name: string;
  description: string | null;
  _count: { families: number; members: number };
};

export default function VillagesPage() {
  const router = useRouter();
  const { isSuperAdmin } = usePermissions();
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New village form state
  const [showForm, setShowForm] = useState(false);
  const [villageName, setVillageName] = useState("");
  const [villageDesc, setVillageDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchVillages();
  }, []);

  async function fetchVillages() {
    try {
      setLoading(true);
      const res = await fetch("/api/villages");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل تحميل القرى");
      setVillages(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!villageName.trim()) {
      setFormError("اسم القرية مطلوب");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/villages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: villageName.trim(), description: villageDesc.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل إنشاء القرية");

      // Select the new village and go to dashboard
      const newVillage: Village = json.data;
      localStorage.setItem("selectedVillageId", newVillage.id);
      router.push("/dashboard");
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function selectVillage(id: string) {
    localStorage.setItem("selectedVillageId", id);
    router.push("/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Home className="w-6 h-6 text-blue-400" />
        <h1 className="text-2xl font-bold text-white">القرى</h1>
      </div>

      {/* Create button */}
      {isSuperAdmin && (
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {showForm ? "إلغاء" : "إضافة قرية جديدة"}
        </button>
      )}

      {/* Create form */}
      {isSuperAdmin && showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-white">قرية جديدة</h2>

          <div>
            <label className="mb-1 block text-sm text-slate-300">اسم القرية *</label>
            <input
              required
              value={villageName}
              onChange={(e) => setVillageName(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white outline-none focus:border-blue-500"
              placeholder="مثال: قرية الزهراء"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">وصف (اختياري)</label>
            <textarea
              rows={3}
              value={villageDesc}
              onChange={(e) => setVillageDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white outline-none focus:border-blue-500 resize-none"
              placeholder="وصف مختصر للقرية..."
            />
          </div>

          {formError && <p className="text-sm text-red-400">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/60 text-white px-4 py-2 rounded-lg transition font-medium"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {submitting ? "جاري الإنشاء..." : "إنشاء القرية"}
          </button>
        </form>
      )}

      {/* Villages list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin ml-2" />
          جاري تحميل القرى...
        </div>
      ) : error ? (
        <p className="text-red-400 text-center py-8">{error}</p>
      ) : villages.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-10 text-center text-slate-400">
          {isSuperAdmin
            ? "لا توجد قرى بعد. أنشئ أول قرية أعلاه."
            : "لا توجد قرى متاحة حالياً. تواصل مع Super Admin لإضافة قرية."}
        </div>
      ) : (
        <div className="space-y-3">
          {villages.map((v) => (
            <button
              key={v.id}
              onClick={() => selectVillage(v.id)}
              className="w-full text-right bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500 rounded-lg p-5 transition group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition">
                    {v.name}
                  </h3>
                  {v.description && (
                    <p className="text-slate-400 text-sm mt-1 line-clamp-1">{v.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Home className="w-3.5 h-3.5" />
                      {formatNumberAr(v._count.families)} عائلة
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {formatNumberAr(v._count.members)} فرد
                    </span>
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
