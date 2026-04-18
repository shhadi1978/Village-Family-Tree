"use client";

import { useEffect, useMemo, useState } from "react";
import {
  hasFamilyPermission,
  type FamilyPermissionAction,
  type FamilyRole,
} from "@/lib/family-rbac";

export type UserPermissions = {
  userId: string;
  isSuperAdmin: boolean;
  roleOverride?:
    | "SUPER_ADMIN"
    | "ALL_FAMILIES_ADMIN"
    | "FAMILY_ADMIN"
    | "FAMILY_EDITOR"
    | "VIEWER"
    | null;
  roleScopeFamilyId?: string | null;
  familyRoles: Record<string, FamilyRole>;
  manageableVillageIds: string[];
  managedFamilyIds: string[];
  canCreateFamily: boolean;
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

  const familyRoleMap = permissions?.familyRoles || {};
  const manageableVillageSet = useMemo(
    () => new Set(permissions?.manageableVillageIds || []),
    [permissions]
  );

  const hasPermission = (
    familyId: string | null | undefined,
    action: FamilyPermissionAction
  ) => {
    if (!familyId || !permissions) {
      return false;
    }

    if (permissions.isSuperAdmin) {
      return true;
    }

    return hasFamilyPermission(familyRoleMap[familyId], action);
  };

  const getFamilyRole = (familyId?: string | null): FamilyRole | null => {
    if (!familyId || !permissions) {
      return null;
    }

    if (permissions.isSuperAdmin) {
      return "all_families_admin";
    }

    return familyRoleMap[familyId] || null;
  };

  const canManageFamily = (familyId?: string | null) => {
    if (!familyId || !permissions) {
      return false;
    }

    return permissions.isSuperAdmin || managedFamilySet.has(familyId);
  };

  const canCreateFamilyInVillage = (villageId?: string | null) => {
    if (!permissions) {
      return false;
    }

    if (permissions.isSuperAdmin) {
      return true;
    }

    if (!villageId) {
      return Boolean(permissions.canCreateFamily);
    }

    return manageableVillageSet.has(villageId);
  };

  const effectiveRoleLabel = (() => {
    const role = permissions?.roleOverride;
    if (role === "SUPER_ADMIN") return "مدير عام";
    if (role === "ALL_FAMILIES_ADMIN") return "مدير كل العائلات";
    if (role === "FAMILY_ADMIN") return "مدير عائلة واحدة";
    if (role === "FAMILY_EDITOR") return "محرر عائلة واحدة";
    if (role === "VIEWER") return "مشاهد";
    if (permissions?.isSuperAdmin) return "مدير عام";
    if (permissions?.canManageAnyFamily) return "مدير/محرر";
    return "مشاهد";
  })();

  return {
    permissions,
    loading,
    error,
    isSuperAdmin: !!permissions?.isSuperAdmin,
    canCreateFamily: !!permissions?.canCreateFamily,
    canManageAnyFamily: !!permissions?.canManageAnyFamily,
    effectiveRoleLabel,
    roleScopeFamilyId: permissions?.roleScopeFamilyId || null,
    getFamilyRole,
    hasFamilyPermission: hasPermission,
    canManageFamily,
    canCreateFamilyInVillage,
    canEditFamily: (familyId?: string | null) => hasPermission(familyId, "family:update"),
    canDeleteFamily: (familyId?: string | null) => hasPermission(familyId, "family:delete"),
    canCreateMember: (familyId?: string | null) => hasPermission(familyId, "member:create"),
    canEditMember: (familyId?: string | null) => hasPermission(familyId, "member:update"),
    canDeleteMember: (familyId?: string | null) => hasPermission(familyId, "member:delete"),
    canCreateRelationship: (familyId?: string | null) => hasPermission(familyId, "relationship:create"),
    canDeleteRelationship: (familyId?: string | null) => hasPermission(familyId, "relationship:delete"),
  };
}
