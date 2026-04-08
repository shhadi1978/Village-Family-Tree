"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import FamilyForm from "@/components/FamilyForm";
import { useFamilies } from "@/lib/hooks/use-api";
import { usePermissions } from "@/lib/hooks/use-permissions";

type FamilyModel = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  photoUrl?: string | null;
  villageId: string;
};

export default function FamilyEditPage() {
  const params = useParams();
  const router = useRouter();
  const familyId = params.familyId as string;
  const { getFamily } = useFamilies();
  const { canEditFamily, loading: permissionsLoading } = usePermissions();

  const [family, setFamily] = useState<FamilyModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFamily = async () => {
      try {
        const data = (await getFamily(familyId)) as FamilyModel;
        setFamily(data);
      } catch (err) {
        console.error("Error loading family:", err);
        setError(err instanceof Error ? err.message : "تعذر تحميل بيانات العائلة");
      } finally {
        setLoading(false);
      }
    };

    if (familyId) {
      loadFamily();
    }
  }, [familyId, getFamily]);

  const initialData = useMemo(() => {
    if (!family) {
      return undefined;
    }

    return {
      name: family.name,
      slug: family.slug,
      description: family.description || "",
      photoUrl: family.photoUrl || "",
    };
  }, [family]);

  if (permissionsLoading) {
    return <div className="text-slate-400">جاري التحقق من الصلاحيات...</div>;
  }

  if (!canEditFamily(familyId)) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/families"
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </Link>

        <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 text-yellow-200">
          لا تملك صلاحية تعديل هذه العائلة.
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="text-slate-400">جاري تحميل بيانات العائلة...</div>;
  }

  if (error || !family) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/families"
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </Link>

        <div className="bg-red-900 border border-red-700 rounded-lg p-4 text-red-200">
          {error || "العائلة غير موجودة"}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Link
          href={`/dashboard/families/${family.id}`}
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          العودة إلى العائلة
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold text-white">تعديل بيانات العائلة</h1>
        <p className="text-slate-400 mt-2">قم بتحديث بيانات {family.name}</p>
      </div>

      <FamilyForm
        familyId={family.id}
        villageId={family.villageId}
        initialData={initialData}
        onSuccess={() => router.push(`/dashboard/families/${family.id}`)}
        onCancel={() => router.back()}
      />
    </div>
  );
}
