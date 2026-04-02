"use client";

import { useEffect, useState } from "react";

type DevRoleState = {
  isDev: boolean;
  isConfiguredSuperAdmin: boolean;
  roleMode: "SUPER_ADMIN" | "FAMILY_ADMIN" | "VIEWER";
  isSuperAdminEffective: boolean;
  isTemporarilyDisabled: boolean;
};

export default function DevRoleSwitcher() {
  const [state, setState] = useState<DevRoleState | null>(null);
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
          setState(payload?.data as DevRoleState);
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

  const updateRoleMode = async (
    roleMode: "SUPER_ADMIN" | "FAMILY_ADMIN" | "VIEWER"
  ) => {
    if (!state) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch("/api/dev/super-admin-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleMode }),
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

  if (!state?.isDev || !state?.isConfiguredSuperAdmin) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-600/40 bg-amber-600/10 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-200">Dev Role Switcher</p>
          <p className="text-xs text-amber-100/90">
            الوضع الحالي: {
              state.roleMode === "SUPER_ADMIN"
                ? "Super Admin"
                : state.roleMode === "FAMILY_ADMIN"
                  ? "Family Admin"
                  : "Normal User"
            }
          </p>
        </div>

        <select
          value={state.roleMode}
          onChange={(e) =>
            updateRoleMode(
              e.target.value as "SUPER_ADMIN" | "FAMILY_ADMIN" | "VIEWER"
            )
          }
          disabled={saving}
          className="px-2 py-1.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-100 text-xs font-semibold"
        >
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="FAMILY_ADMIN">Family Admin</option>
          <option value="VIEWER">Normal User</option>
        </select>
      </div>

      {saving && <p className="text-xs text-amber-200">جاري التبديل...</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
