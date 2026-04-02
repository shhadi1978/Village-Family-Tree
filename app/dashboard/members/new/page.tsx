"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MemberForm from "@/components/MemberForm";
import { useFamilies } from "@/lib/hooks/use-api";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewMemberPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialFamilyId = searchParams.get("familyId") || "";

  const { getFamily } = useFamilies();
  const {
    families: villageFamilies,
    loading: familiesLoading,
    error: familiesError,
    getFamilies,
  } = useFamilies();
  const { canManageFamily, loading: permissionsLoading } = usePermissions();
  const [selectedFamilyId, setSelectedFamilyId] = useState(initialFamilyId);
  const [villageId, setVillageId] = useState<string | null>(null);
  const [family, setFamily] = useState<any | null>(null);
  const [familyLoading, setFamilyLoading] = useState(true);

  useEffect(() => {
    const storedVillageId = localStorage.getItem("selectedVillageId");
    setVillageId(storedVillageId);
  }, []);

  useEffect(() => {
    if (!villageId) {
      return;
    }

    getFamilies(villageId, true).catch((err) => {
      console.error("Error loading families list:", err);
    });
  }, [villageId, getFamilies]);

  const manageableFamilies = useMemo(() => {
    if (!Array.isArray(villageFamilies)) {
      return [];
    }

    return villageFamilies.filter((candidate: any) => canManageFamily(candidate.id));
  }, [villageFamilies, canManageFamily]);

  useEffect(() => {
    if (selectedFamilyId) {
      const loadFamily = async () => {
        try {
          setFamilyLoading(true);
          const data = await getFamily(selectedFamilyId);
          setFamily(data);
        } catch (err) {
          console.error("Error loading family:", err);
          setFamily(null);
        } finally {
          setFamilyLoading(false);
        }
      };

      loadFamily();
    } else {
      setFamily(null);
      setFamilyLoading(false);
    }
  }, [selectedFamilyId, getFamily]);

  const handleSuccess = () => {
    if (selectedFamilyId) {
      router.push(`/dashboard/families/${selectedFamilyId}`);
    } else {
      router.push("/dashboard/members");
    }
  };

  if (permissionsLoading) {
    return <div className="text-slate-400">جاري التحقق من الصلاحيات...</div>;
  }

  if (!selectedFamilyId) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/families"
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </Link>

        {!villageId ? (
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 text-yellow-200">
            اختر قرية أولاً من لوحة التحكم لعرض العائلات.
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
            <h1 className="text-2xl font-bold text-white">اختر العائلة أولاً</h1>
            <p className="text-slate-400 text-sm">
              اختر العائلة التي تريد إضافة الفرد إليها.
            </p>

            <div>
              <label className="block text-sm text-slate-300 mb-2">العائلة</label>
              <select
                value={selectedFamilyId}
                onChange={(e) => {
                  const nextFamilyId = e.target.value;
                  setSelectedFamilyId(nextFamilyId);
                  const target = nextFamilyId
                    ? `/dashboard/members/new?familyId=${nextFamilyId}`
                    : "/dashboard/members/new";
                  router.replace(target);
                }}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">
                  {familiesLoading ? "جاري تحميل العائلات..." : "اختر عائلة"}
                </option>
                {manageableFamilies.map((candidate: any) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </div>

            {familiesError && (
              <p className="text-sm text-red-400">
                حدث خطأ أثناء تحميل العائلات: {familiesError.message}
              </p>
            )}

            {!familiesLoading && manageableFamilies.length === 0 && !familiesError && (
              <p className="text-sm text-yellow-300">
                لا توجد عائلات متاحة لك للإدارة حالياً.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (familyLoading) {
    return <div className="text-slate-400">جاري التحميل...</div>;
  }

  if (!canManageFamily(selectedFamilyId)) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/families"
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </Link>
        <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 text-yellow-200">
          لا تملك صلاحية إضافة أفراد لهذه العائلة.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Link
          href={`/dashboard/families/${selectedFamilyId}`}
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          العودة إلى العائلة
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          إضافة فرد جديد {family && `إلى ${family.name}`}
        </h1>
        <p className="text-slate-400 mt-2">
          أضف فرداً جديداً مع بياناته ومعلوماته الأساسية
        </p>
      </div>

      <MemberForm
        familyId={selectedFamilyId}
        villageId={family?.villageId}
        initialData={{
          lastName: String(family?.name || "").trim(),
        }}
        onSuccess={handleSuccess}
        onCancel={() => router.back()}
      />
    </div>
  );
}
