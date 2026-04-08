"use client";

import { useEffect, useState } from "react";
import { useFamilies } from "@/lib/hooks/use-api";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatNumberAr } from "@/lib/i18n/format";
import Link from "next/link";
import { Plus, Trash2, Edit, Users } from "lucide-react";

type FamilySortMode = "members-desc" | "members-asc" | "name-asc";

export default function FamiliesPage() {
  const { families, loading, error, getFamilies, deleteFamily } = useFamilies();
  const {
    isSuperAdmin,
    canManageAnyFamily,
    canManageFamily,
    canEditFamily,
    canDeleteFamily,
  } = usePermissions();
  const [villageId, setVillageId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<FamilySortMode>("members-desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const familyPayload = (families as any) || null;
  const familyItems = Array.isArray(familyPayload)
    ? familyPayload
    : Array.isArray(familyPayload?.items)
      ? familyPayload.items
      : [];
  const totalPages =
    typeof familyPayload?.totalPages === "number" ? familyPayload.totalPages : 1;
  const totalFamilies =
    typeof familyPayload?.total === "number"
      ? familyPayload.total
      : familyItems.length;

  useEffect(() => {
    const defaultVillageId = localStorage.getItem("selectedVillageId");
    if (defaultVillageId) {
      setVillageId(defaultVillageId);
      getFamilies(defaultVillageId, true, undefined, 1, pageSize, sortMode);
    }
  }, [getFamilies, sortMode]);

  useEffect(() => {
    if (!villageId) {
      return;
    }

    const timeout = setTimeout(() => {
      getFamilies(villageId, true, searchTerm, page, pageSize, sortMode);
    }, 250);

    return () => clearTimeout(timeout);
  }, [villageId, searchTerm, page, sortMode, getFamilies]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, sortMode]);

  const handleDelete = async (familyId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه العائلة؟ لا يمكن التراجع عن هذا الإجراء.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteFamily(familyId);
      // Refresh families list
      if (villageId) {
        await getFamilies(villageId, true, searchTerm, page, pageSize, sortMode);
      }
    } catch (err) {
      console.error("Error deleting family:", err);
      alert("فشل حذف العائلة");
    } finally {
      setIsDeleting(false);
      setSelectedFamilyId(null);
    }
  };

  if (!villageId) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 mb-4">يرجى اختيار قرية أولاً</p>
        <Link
          href="/dashboard"
          className="text-blue-400 hover:text-blue-300"
        >
          العودة إلى لوحة التحكم
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {canManageAnyFamily ? "إدارة العائلات" : "عرض العائلات"}
          </h1>
          <p className="text-slate-400 mt-1">
            {canManageAnyFamily ? "إدارة جميع عائلات القرية" : "استعراض جميع عائلات القرية"}
          </p>
        </div>
        {isSuperAdmin && (
          <Link
            href="/dashboard/families/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            عائلة جديدة
          </Link>
        )}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-300 mb-2">البحث عن عائلة بالاسم</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="اكتب الاسم الكامل أو جزءاً منه..."
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">ترتيب العائلات</label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as FamilySortMode)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="members-desc">الأكثر أفراداً أولاً</option>
              <option value="members-asc">الأقل أفراداً أولاً</option>
              <option value="name-asc">حسب الاسم (أبجدي)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-slate-800 rounded-lg p-8 text-center text-slate-400">
          جاري تحميل العائلات...
        </div>
      ) : error ? (
        <div className="bg-red-900 border border-red-700 rounded-lg p-6 text-red-200">
          حدث خطأ أثناء تحميل العائلات: {error.message}
        </div>
      ) : familyItems.length > 0 ? (
        <div className="grid gap-4">
          {familyItems.map((family: any) => {
            const canManage = canManageFamily(family.id);
            const canEdit = canEditFamily(family.id);
            const canDelete = canDeleteFamily(family.id);
            return (
            <div
              key={family.id}
              className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {family.name}
                  </h3>
                  {family.description && (
                    <p className="text-slate-400 text-sm mb-2">
                      {family.description}
                    </p>
                  )}
                  <div className="flex items-center gap-6 text-sm text-slate-400">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{formatNumberAr(family._count?.members || 0)} فرد</span>
                    </div>
                    {family.stats && (
                      <>
                        <div>
                          {formatNumberAr(family.stats.livingMembers)} على قيد الحياة
                        </div>
                        <div>
                          {formatNumberAr(family.stats.deceasedMembers)} متوفى
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {(canEdit || canDelete) && (
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Link
                        href={`/dashboard/families/${family.id}/edit`}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"
                        title="تعديل"
                      >
                        <Edit className="w-5 h-5" />
                      </Link>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(family.id)}
                        disabled={isDeleting}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition"
                        title="حذف"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap items-center gap-3">
                <Link
                  href={`/dashboard/families/${family.id}`}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  {canManage ? "عرض وإدارة الأفراد ←" : "عرض الأفراد ←"}
                </Link>
                <Link
                  href={`/family/${family.id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white text-sm transition"
                >
                  عرض شجرة العائلة
                </Link>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <p className="text-slate-400 mb-6">
            {searchTerm.trim().length > 0
              ? "لا توجد عائلات مطابقة لنتيجة البحث"
              : "لم يتم إنشاء أي عائلة بعد"}
          </p>
          {isSuperAdmin && (
            <Link
              href="/dashboard/families/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              أنشئ أول عائلة
            </Link>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-sm text-slate-300">
            الصفحة {formatNumberAr(page)} من {formatNumberAr(totalPages)}
            {" • "}
            المجموع: {formatNumberAr(totalFamilies)}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="px-3 py-1.5 rounded-md bg-slate-700 text-white disabled:opacity-50"
            >
              السابق
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="px-3 py-1.5 rounded-md bg-slate-700 text-white disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
