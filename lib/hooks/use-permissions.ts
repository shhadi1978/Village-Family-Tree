"use client";

import { useEffect, useMemo, useState } from "react";

export type UserPermissions = {
  userId: string;
  isSuperAdmin: boolean;
  roleOverride?: "SUPER_ADMIN" | "FAMILY_ADMIN" | "VIEWER" | null;
  managedFamilyIds: string[];
  canManageAnyFamily: boolean;
};

export function usePermissions() {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadPermissions = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/me/permissions");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load permissions");
        }

        if (mounted) {
          setPermissions(payload.data as UserPermissions);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load permissions");
          setPermissions(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadPermissions();

    return () => {
      mounted = false;
    };
  }, []);

  const managedFamilySet = useMemo(
    () => new Set(permissions?.managedFamilyIds || []),
    [permissions]
  );

  const canManageFamily = (familyId?: string | null) => {
    if (!familyId || !permissions) {
      return false;
    }

    return permissions.isSuperAdmin || managedFamilySet.has(familyId);
  };

  return {
    permissions,
    loading,
    error,
    isSuperAdmin: !!permissions?.isSuperAdmin,
    canManageAnyFamily: !!permissions?.canManageAnyFamily,
    canManageFamily,
  };
}
