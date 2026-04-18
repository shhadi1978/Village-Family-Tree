"use client";

import { useEffect, useState } from "react";
import { useFamilies, useMembers } from "@/lib/hooks/use-api";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatNumberAr } from "@/lib/i18n/format";
import { getMemberDisplayName } from "@/lib/member-display";
import Link from "next/link";
import { Plus, Users, Home, ArrowRight, Search, ChevronDown } from "lucide-react";

type SearchFamily = {
  id: string;
  name: string;
  _count?: {
    members?: number;
  };
};

type SearchMember = {
  id: string;
  fullName: string;
  nickname?: string;
  firstName?: string;
  lastName?: string;
  familyId: string;
  family?: {
    name?: string;
  };
};

export default function DashboardPage() {
  const { families, loading, error, getFamilies } = useFamilies();
  const { getMembers } = useMembers();
  const { isSuperAdmin, canManageAnyFamily, canCreateFamilyInVillage } = usePermissions();
  const [villageId, setVillageId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [familyResults, setFamilyResults] = useState<SearchFamily[]>([]);
  const [memberResults, setMemberResults] = useState<SearchMember[]>([]);

  useEffect(() => {
    // In a real app, you'd fetch the user's towns/villages
    // For now, we'll need to hardcode or get from context
    // This is a placeholder - you'd typically fetch user's default village
    const defaultVillageId = localStorage.getItem("selectedVillageId");
    if (defaultVillageId) {
      setVillageId(defaultVillageId);
      getFamilies(defaultVillageId, true);
    }
  }, [getFamilies]);

  useEffect(() => {
    if (!villageId) {
      return;
    }

    const term = globalSearch.trim();
    if (!term) {
      setFamilyResults([]);
      setMemberResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);

      try {
        const [familiesData, membersData] = await Promise.all([
          getFamilies(villageId, true, term),
          getMembers(undefined, villageId, term),
        ]);

        const familiesPayload = familiesData as SearchFamily[];
        const membersPayload = membersData as SearchMember[];

        setFamilyResults(Array.isArray(familiesPayload) ? familiesPayload : []);
        setMemberResults(Array.isArray(membersPayload) ? membersPayload : []);
      } catch (err) {
        console.error("Error running global search:", err);
        setSearchError(
          err instanceof Error ? err.message : "تعذر تنفيذ البحث"
        );
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [globalSearch, villageId, getFamilies, getMembers]);

  if (!villageId) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
          <Home className="w-12 h-12 text-blue-500 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-white mb-2">
            أهلاً بك في لوحة التحكم
          </h2>
          <p className="text-slate-400 mb-6">
            {isSuperAdmin
              ? "اختر قرية أو أنشئ قرية جديدة لإدارة شجرة العائلات"
              : "اختر قرية لعرض شجرة العائلات"}
          </p>
          <Link
            href="/dashboard/villages"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            اختيار قرية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Global Search */}
      <details className="group bg-slate-800 rounded-lg border border-slate-700 p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-200">بحث موحد (العائلات + الأفراد)</span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
        </summary>

        <div className="mt-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="ابحث باسم العائلة أو الاسم الكامل للفرد..."
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {globalSearch.trim().length > 0 && (
            <div className="mt-4 space-y-3">
              {searchLoading ? (
                <p className="text-slate-400 text-sm">جاري البحث...</p>
              ) : searchError ? (
                <p className="text-red-400 text-sm">{searchError}</p>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-slate-300 mb-2">
                      العائلات ({formatNumberAr(familyResults.length)})
                    </p>
                    {familyResults.length > 0 ? (
                      <div className="space-y-2">
                        {familyResults.slice(0, 5).map((family) => (
                          <Link
                            key={family.id}
                            href={`/dashboard/families/${family.id}`}
                            className="block text-blue-400 hover:text-blue-300 text-sm"
                          >
                            {family.name} ({formatNumberAr(family._count?.members || 0)} فرد)
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">لا توجد عائلات مطابقة.</p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-slate-300 mb-2">
                      الأفراد ({formatNumberAr(memberResults.length)})
                    </p>
                    {memberResults.length > 0 ? (
                      <div className="space-y-2">
                        {memberResults.slice(0, 7).map((member) => (
                          <Link
                            key={member.id}
                            href={`/family/${member.familyId}?member=${member.id}`}
                            className="block text-blue-400 hover:text-blue-300 text-sm"
                          >
                            {getMemberDisplayName(member)}
                            {member.family?.name ? ` - ${member.family.name}` : ""}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">لا يوجد أفراد مطابقون.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </details>

      {/* Header Stats */}
      <details className="group bg-slate-800 rounded-lg border border-slate-700 p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-200">إحصائيات سريعة</span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
        </summary>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">إجمالي العائلات</p>
                <p className="text-3xl font-bold mt-1">
                  {formatNumberAr(Array.isArray(families) ? families.length : 0)}
                </p>
              </div>
              <Users className="w-12 h-12 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">
                  إجمالي الأفراد
                </p>
                <p className="text-3xl font-bold mt-1">
                  {formatNumberAr(Array.isArray(families)
                    ? families.reduce(
                        (sum: number, f: any) => sum + (f._count?.members || 0),
                        0
                      )
                    : 0)}
                </p>
              </div>
              <Home className="w-12 h-12 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">
                  {canManageAnyFamily ? "العائلات المُدارة" : "العائلات المتاحة"}
                </p>
                <p className="text-3xl font-bold mt-1">
                  {formatNumberAr(Array.isArray(families) ? families.length : 0)}
                </p>
              </div>
              <Users className="w-12 h-12 opacity-50" />
            </div>
          </div>
        </div>
      </details>

      {/* Families List */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 className="text-xl font-bold text-white">
            {canManageAnyFamily ? "عائلاتك" : "عائلات القرية"}
          </h2>
          {canCreateFamilyInVillage(villageId) && (
            <Link
              href="/dashboard/families/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              عائلة جديدة
            </Link>
          )}
        </div>

        {loading ? (
          <div className="text-slate-400 text-center py-8">
            جاري تحميل العائلات...
          </div>
        ) : error ? (
          <div className="text-red-400 text-center py-8">
            حدث خطأ أثناء تحميل العائلات: {error.message}
          </div>
        ) : Array.isArray(families) && families.length > 0 ? (
          <div className="space-y-3">
            {families.map((family: any) => (
              <Link
                key={family.id}
                href={`/dashboard/families/${family.id}`}
                className="flex items-center justify-between p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition border border-slate-600 hover:border-slate-500"
              >
                <div>
                  <h3 className="font-semibold text-white">{family.name}</h3>
                  <p className="text-slate-400 text-sm">
                    {formatNumberAr(family._count?.members || 0)} فرد
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-400 mb-4">لا توجد عائلات بعد</p>
            {canCreateFamilyInVillage(villageId) && (
              <Link
                href="/dashboard/families/new"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                إنشاء أول عائلة
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {canManageAnyFamily && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/members/new"
            className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg p-6 text-white transition"
          >
            <Users className="w-8 h-8 mb-2" />
            <h3 className="font-semibold mb-1">إضافة فرد</h3>
            <p className="text-blue-100 text-sm">أضف فرداً جديداً إلى العائلة</p>
          </Link>

          <Link
            href="/dashboard/families"
            className="bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg p-6 text-white transition"
          >
            <Home className="w-8 h-8 mb-2" />
            <h3 className="font-semibold mb-1">إدارة العائلات</h3>
            <p className="text-purple-100 text-sm">تعديل أو حذف بيانات العائلات التابعة لك</p>
          </Link>
        </div>
      )}
    </div>
  );
}
