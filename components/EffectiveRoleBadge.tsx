"use client";

import { useMemo } from "react";
import { usePermissions } from "@/lib/hooks/use-permissions";

export default function EffectiveRoleBadge() {
  const { loading, effectiveRoleLabel, roleScopeFamilyId } = usePermissions();

  const toneClasses = useMemo(() => {
    if (effectiveRoleLabel === "مدير عام") {
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    }

    if (effectiveRoleLabel === "مدير كل العائلات") {
      return "border-blue-500/40 bg-blue-500/10 text-blue-200";
    }

    if (effectiveRoleLabel === "مدير عائلة واحدة" || effectiveRoleLabel === "محرر عائلة واحدة") {
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    }

    return "border-slate-500/40 bg-slate-500/10 text-slate-200";
  }, [effectiveRoleLabel]);

  if (loading) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses}`}>
      <span>الدور الفعّال:</span>
      <span>{effectiveRoleLabel}</span>
      {roleScopeFamilyId && (
        <span className="opacity-80">({roleScopeFamilyId.slice(0, 8)})</span>
      )}
    </div>
  );
}