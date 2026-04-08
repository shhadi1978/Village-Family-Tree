import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDevRoleOverrideByCookie, isSuperAdmin } from "@/lib/authz";
import * as familyService from "@/lib/services/family";

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
    const baseManagedFamilyIds = await familyService.getManagedFamilyIdsForUser(userId);

    const managedFamilyIds =
      roleOverride === "VIEWER" ? [] : baseManagedFamilyIds;

    return NextResponse.json(
      {
        data: {
          userId,
          isSuperAdmin: superAdmin,
          roleOverride,
          managedFamilyIds,
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
