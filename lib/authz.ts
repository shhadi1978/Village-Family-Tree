import { cookies } from "next/headers";

export const DEV_SUPER_ADMIN_DISABLED_COOKIE = "dev_super_admin_disabled";
export const DEV_ROLE_OVERRIDE_COOKIE = "dev_role_override";
export type DevRoleOverride = "SUPER_ADMIN" | "FAMILY_ADMIN" | "VIEWER";

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
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  try {
    const cookieStore = cookies();
    const disabledValue = cookieStore.get(DEV_SUPER_ADMIN_DISABLED_COOKIE)?.value;
    return disabledValue === "1";
  } catch {
    return false;
  }
}

export function getDevRoleOverrideByCookie(): DevRoleOverride | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  try {
    const cookieStore = cookies();
    const mode = cookieStore.get(DEV_ROLE_OVERRIDE_COOKIE)?.value;

    if (mode === "SUPER_ADMIN" || mode === "FAMILY_ADMIN" || mode === "VIEWER") {
      return mode;
    }

    return null;
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
  if (roleOverride === "FAMILY_ADMIN" || roleOverride === "VIEWER") {
    return false;
  }

  // Dev override can only downgrade a real super admin temporarily.
  if (isDevSuperAdminDisabledByCookie()) {
    return false;
  }

  return true;
}
