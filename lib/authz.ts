import { cookies } from "next/headers";

export const DEV_SUPER_ADMIN_DISABLED_COOKIE = "dev_super_admin_disabled";
export const DEV_ROLE_OVERRIDE_COOKIE = "dev_role_override";
export const DEV_ROLE_SCOPE_FAMILY_COOKIE = "dev_role_scope_family_id";
export type DevRoleOverride =
  | "SUPER_ADMIN"
  | "ALL_FAMILIES_ADMIN"
  | "FAMILY_ADMIN"
  | "FAMILY_EDITOR"
  | "VIEWER";

export function getSuperAdminIds(): string[] {
  return (process.env.SUPER_ADMIN_CLERK_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isConfiguredSuperAdmin(userId?: string | null): boolean {
  if (!userId) {
    return false;
  }

  return getSuperAdminIds().includes(userId);
}

export function isDevSuperAdminDisabledByCookie(): boolean {
  try {
    const cookieStore = cookies();
    const disabledValue = cookieStore.get(DEV_SUPER_ADMIN_DISABLED_COOKIE)?.value;
    return disabledValue === "1";
  } catch {
    return false;
  }
}

export function getDevRoleOverrideByCookie(): DevRoleOverride | null {
  try {
    const cookieStore = cookies();
    const mode = cookieStore.get(DEV_ROLE_OVERRIDE_COOKIE)?.value;

    if (
      mode === "SUPER_ADMIN" ||
      mode === "ALL_FAMILIES_ADMIN" ||
      mode === "FAMILY_ADMIN" ||
      mode === "FAMILY_EDITOR" ||
      mode === "VIEWER"
    ) {
      return mode;
    }

    return null;
  } catch {
    return null;
  }
}

export function getDevRoleScopeFamilyIdByCookie(): string | null {
  try {
    const cookieStore = cookies();
    const familyId = cookieStore.get(DEV_ROLE_SCOPE_FAMILY_COOKIE)?.value?.trim();
    return familyId || null;
  } catch {
    return null;
  }
}

export function isSuperAdmin(userId?: string | null): boolean {
  const configuredSuperAdmin = isConfiguredSuperAdmin(userId);

  if (!configuredSuperAdmin) {
    return false;
  }

  const roleOverride = getDevRoleOverrideByCookie();
  if (roleOverride && roleOverride !== "SUPER_ADMIN") {
    return false;
  }

  // Dev override can only downgrade a real super admin temporarily.
  if (isDevSuperAdminDisabledByCookie()) {
    return false;
  }

  return true;
}
