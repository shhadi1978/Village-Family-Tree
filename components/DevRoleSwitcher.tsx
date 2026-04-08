"use client";

import { useEffect, useState } from "react";

type DevRoleMode =
  | "SUPER_ADMIN"
  | "ALL_FAMILIES_ADMIN"
  | "FAMILY_ADMIN"
  | "FAMILY_EDITOR"
  | "VIEWER";

type DevRoleState = {
  isDev: boolean;
  isConfiguredSuperAdmin: boolean;
  roleMode: DevRoleMode;
  scopeFamilyId?: string | null;
  isSuperAdminEffective: boolean;
  isTemporarilyDisabled: boolean;
};

type FamilyOption = {
  id: string;
  name: string;
};

function roleLabel(mode: DevRoleMode): string {
  if (mode === "SUPER_ADMIN") return "مدير عام";
  if (mode === "ALL_FAMILIES_ADMIN") return "مدير كل العائلات";
  if (mode === "FAMILY_ADMIN") return "مدير عائلة واحدة";
  if (mode === "FAMILY_EDITOR") return "محرر عائلة واحدة";
  return "مشاهد";
}

function roleNeedsFamilyScope(mode: DevRoleMode): boolean {
  return mode === "FAMILY_ADMIN" || mode === "FAMILY_EDITOR";
}

export default function DevRoleSwitcher() {
  const [state, setState] = useState<DevRoleState | null>(null);
  const [selectedMode, setSelectedMode] = useState<DevRoleMode>("SUPER_ADMIN");
  const [scopeFamilyId, setScopeFamilyId] = useState("");
  const [families, setFamilies] = useState<FamilyOption[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadState = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/dev/super-admin-mode", {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "تعذر تحميل وضع الدور التطويري");
        }

        if (mounted) {
          const nextState = payload?.data as DevRoleState;
          setState(nextState);
          setSelectedMode(nextState.roleMode || "SUPER_ADMIN");
          setScopeFamilyId(nextState.scopeFamilyId || "");
        }
      } catch (err) {
        if (mounted) {
          setState(null);
          setError(
            err instanceof Error ? err.message : "تعذر تحميل وضع الدور التطويري"
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadState();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadFamilies = async () => {
      const selectedVillageId = localStorage.getItem("selectedVillageId");
      if (!selectedVillageId) {
        if (mounted) {
          setFamilies([]);
        }
        return;
      }

      try {
        setFamiliesLoading(true);
        const response = await fetch(
          `/api/families?villageId=${encodeURIComponent(
            selectedVillageId
          )}&sort=name-asc`,
          { cache: "no-store" }
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "تعذر تحميل العائلات");
        }

        const items = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.data?.items)
            ? payload.data.items
            : [];

        if (mounted) {
          setFamilies(
            items
              .filter((item: any) => item?.id)
              .map((item: any) => ({ id: item.id as string, name: item.name as string }))
          );
        }
      } catch {
        if (mounted) {
          setFamilies([]);
        }
      } finally {
        if (mounted) {
          setFamiliesLoading(false);
        }
      }
    };

    loadFamilies();

    return () => {
      mounted = false;
    };
  }, []);

  const updateRoleMode = async () => {
    if (!state) {
      return;
    }

    if (roleNeedsFamilyScope(selectedMode) && !scopeFamilyId) {
      setError("اختر عائلة عند استخدام وضع مدير/محرر عائلة واحدة");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch("/api/dev/super-admin-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleMode: selectedMode,
          scopeFamilyId: roleNeedsFamilyScope(selectedMode) ? scopeFamilyId : null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "تعذر تحديث وضع الدور التطويري");
      }

      setState(payload?.data as DevRoleState);
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "تعذر تحديث وضع الدور التطويري"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!state?.isConfiguredSuperAdmin) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-600/40 bg-amber-600/10 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-200">Dev Role Switcher</p>
          <p className="text-xs text-amber-100/90">الوضع الحالي: {roleLabel(state.roleMode)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <select
          value={selectedMode}
          onChange={(e) => setSelectedMode(e.target.value as DevRoleMode)}
          disabled={saving}
          className="px-2 py-1.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-100 text-xs font-semibold"
        >
          <option value="SUPER_ADMIN">مدير عام</option>
          <option value="ALL_FAMILIES_ADMIN">مدير كل العائلات</option>
          <option value="FAMILY_ADMIN">مدير عائلة واحدة</option>
          <option value="FAMILY_EDITOR">محرر عائلة واحدة</option>
          <option value="VIEWER">مشاهد</option>
        </select>

        {roleNeedsFamilyScope(selectedMode) && (
          <select
            value={scopeFamilyId}
            onChange={(e) => setScopeFamilyId(e.target.value)}
            disabled={saving || familiesLoading}
            className="px-2 py-1.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-100 text-xs"
          >
            <option value="">{familiesLoading ? "جاري تحميل العائلات..." : "اختر العائلة"}</option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={updateRoleMode}
          disabled={saving}
          className="px-2 py-1.5 rounded-md bg-amber-500/25 border border-amber-400/60 text-amber-100 text-xs font-semibold hover:bg-amber-500/35 disabled:opacity-60"
        >
          تطبيق الدور
        </button>
      </div>

      {saving && <p className="text-xs text-amber-200">جاري التبديل...</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
