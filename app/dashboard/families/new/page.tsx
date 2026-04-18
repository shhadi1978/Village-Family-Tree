"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import FamilyForm from "@/components/FamilyForm";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewFamilyPage() {
  const router = useRouter();
  const { canCreateFamilyInVillage, loading: permissionsLoading } = usePermissions();
  const [villageId, setVillageId] = useState<string | null>(null);

  useEffect(() => {
    // Get village ID from localStorage or props
    const defaultVillageId = localStorage.getItem("selectedVillageId");
    if (defaultVillageId) {
      setVillageId(defaultVillageId);
    }
  }, []);

  const handleSuccess = () => {
    router.push("/dashboard/families");
  };

  if (permissionsLoading || !villageId) {
    return <div className="text-slate-400">جاري التحقق من الصلاحيات...</div>;
  }

  if (!canCreateFamilyInVillage(villageId)) {
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
          هذا الخيار متاح فقط للمدير العام أو مدير كل العائلات في القرية.
        </div>
      </div>
    );
  }

  if (!villageId) {
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
          يرجى اختيار قرية أولاً
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Link
          href="/dashboard/families"
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          العودة إلى العائلات
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-white">إنشاء عائلة جديدة</h1>
        <p className="text-slate-400 mt-2">
          أضف عائلة جديدة إلى قريتك
        </p>
      </div>

      <FamilyForm
        villageId={villageId}
        onSuccess={handleSuccess}
        onCancel={() => router.back()}
      />
    </div>
  );
}
