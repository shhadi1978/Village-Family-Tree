import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getDevRoleOverrideByCookie,
  getDevRoleScopeFamilyIdByCookie,
  isSuperAdmin,
} from "@/lib/authz";
import * as familyService from "@/lib/services/family";
import { hasFamilyPermission } from "@/lib/family-rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/permissions
 * Returns current user's authorization flags for UI gating.
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const superAdmin = isSuperAdmin(userId);
    const roleOverride = getDevRoleOverrideByCookie();
    const roleScopeFamilyId = getDevRoleScopeFamilyIdByCookie();
    const familyRoles = await familyService.getUserFamilyRoleMap(userId);
    let manageableVillageIds: string[] = [];
    try {
      manageableVillageIds = await familyService.getVillageIdsWhereUserIsAdmin(
        userId
      );
    } catch (error) {
      // Do not fail permissions endpoint if optional village-wide lookup fails.
      console.error("Failed to load manageable village ids:", error);
      manageableVillageIds = [];
    }
    const baseManagedFamilyIds = Object.entries(familyRoles)
      .filter(([, role]) => hasFamilyPermission(role, "member:update"))
      .map(([familyId]) => familyId);

    const managedFamilyIds =
      roleOverride === "VIEWER" ? [] : baseManagedFamilyIds;

    return NextResponse.json(
      {
        data: {
          userId,
          isSuperAdmin: superAdmin,
          roleOverride,
          roleScopeFamilyId,
          familyRoles,
          manageableVillageIds,
          managedFamilyIds,
          canCreateFamily: superAdmin || manageableVillageIds.length > 0,
          canManageAnyFamily: superAdmin || managedFamilyIds.length > 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error loading user permissions:", error);
    return NextResponse.json(
      { error: "Failed to load permissions" },
      { status: 500 }
    );
  }
}
