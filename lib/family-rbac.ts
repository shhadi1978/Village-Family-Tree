export const FAMILY_ROLE_VALUES = [
  "viewer",
  "editor",
  "admin",
  "all_families_admin",
] as const;

export type FamilyRole = (typeof FAMILY_ROLE_VALUES)[number];

export type FamilyPermissionAction =
  | "family:update"
  | "family:delete"
  | "member:create"
  | "member:update"
  | "member:delete"
  | "relationship:create"
  | "relationship:delete";

const FAMILY_ROLE_RANK: Record<FamilyRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  all_families_admin: 4,
};

const FAMILY_ROLE_PERMISSIONS: Record<FamilyRole, FamilyPermissionAction[]> = {
  viewer: [],
  editor: ["member:create", "member:update", "relationship:create", "relationship:delete"],
  admin: [
    "family:update",
    "family:delete",
    "member:create",
    "member:update",
    "member:delete",
    "relationship:create",
    "relationship:delete",
  ],
  all_families_admin: [
    "family:update",
    "family:delete",
    "member:create",
    "member:update",
    "member:delete",
    "relationship:create",
    "relationship:delete",
  ],
};

export function normalizeFamilyRole(role?: string | null): FamilyRole {
  if (role === "viewer" || role === "editor" || role === "admin" || role === "all_families_admin") {
    return role;
  }

  return "admin";
}

export function getHigherFamilyRole(
  currentRole?: FamilyRole | null,
  nextRole?: FamilyRole | null
): FamilyRole | null {
  if (!currentRole) {
    return nextRole || null;
  }

  if (!nextRole) {
    return currentRole;
  }

  return FAMILY_ROLE_RANK[nextRole] > FAMILY_ROLE_RANK[currentRole]
    ? nextRole
    : currentRole;
}

export function hasFamilyPermission(
  role: FamilyRole | null | undefined,
  action: FamilyPermissionAction
): boolean {
  if (!role) {
    return false;
  }

  return FAMILY_ROLE_PERMISSIONS[role].includes(action);
}

export function familyRoleCanWrite(role: FamilyRole | null | undefined): boolean {
  return hasFamilyPermission(role, "member:update") || hasFamilyPermission(role, "member:create");
}