import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  DEV_ROLE_SCOPE_FAMILY_COOKIE,
  DEV_ROLE_OVERRIDE_COOKIE,
  DEV_SUPER_ADMIN_DISABLED_COOKIE,
  DevRoleOverride,
  getDevRoleScopeFamilyIdByCookie,
  getDevRoleOverrideByCookie,
  isConfiguredSuperAdmin,
  isDevSuperAdminDisabledByCookie,
  isSuperAdmin,
} from "@/lib/authz";

export const runtime = "nodejs";

/**
 * GET /api/dev/super-admin-mode
 * Returns current dev override status for super admin role.
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configuredSuperAdmin = isConfiguredSuperAdmin(userId);
    const roleMode = getDevRoleOverrideByCookie() || "SUPER_ADMIN";

    return NextResponse.json(
      {
        data: {
          isDev: process.env.NODE_ENV !== "production",
          isConfiguredSuperAdmin: configuredSuperAdmin,
          roleMode,
          scopeFamilyId: getDevRoleScopeFamilyIdByCookie(),
          isSuperAdminEffective: isSuperAdmin(userId),
          isTemporarilyDisabled: isDevSuperAdminDisabledByCookie(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error loading dev super admin mode:", error);
    return NextResponse.json(
      { error: "Failed to load dev super admin mode" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dev/super-admin-mode
 * Body: {
 *   roleMode: "SUPER_ADMIN" | "ALL_FAMILIES_ADMIN" | "FAMILY_ADMIN" | "FAMILY_EDITOR" | "VIEWER",
 *   scopeFamilyId?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isConfiguredSuperAdmin(userId)) {
      return NextResponse.json(
        { error: "Only configured super admin can use this switch" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const roleMode = body?.roleMode as DevRoleOverride | undefined;
    const scopeFamilyId =
      typeof body?.scopeFamilyId === "string" ? body.scopeFamilyId.trim() : "";

    if (
      roleMode !== "SUPER_ADMIN" &&
      roleMode !== "ALL_FAMILIES_ADMIN" &&
      roleMode !== "FAMILY_ADMIN" &&
      roleMode !== "FAMILY_EDITOR" &&
      roleMode !== "VIEWER"
    ) {
      return NextResponse.json(
        {
          error:
            "roleMode is required (SUPER_ADMIN | ALL_FAMILIES_ADMIN | FAMILY_ADMIN | FAMILY_EDITOR | VIEWER)",
        },
        { status: 400 }
      );
    }

    const requiresScopedFamily =
      roleMode === "FAMILY_ADMIN" || roleMode === "FAMILY_EDITOR";

    if (requiresScopedFamily && !scopeFamilyId) {
      return NextResponse.json(
        { error: "scopeFamilyId is required for FAMILY_ADMIN and FAMILY_EDITOR" },
        { status: 400 }
      );
    }

    const response = NextResponse.json(
      {
        data: {
          isDev: process.env.NODE_ENV !== "production",
          isConfiguredSuperAdmin: true,
          roleMode,
          scopeFamilyId: requiresScopedFamily ? scopeFamilyId : null,
          isSuperAdminEffective: roleMode === "SUPER_ADMIN",
          isTemporarilyDisabled: roleMode !== "SUPER_ADMIN",
        },
      },
      { status: 200 }
    );

    response.cookies.set({
      name: DEV_ROLE_OVERRIDE_COOKIE,
      value: roleMode,
      path: "/",
      maxAge: 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
    });

    response.cookies.set({
      name: DEV_ROLE_SCOPE_FAMILY_COOKIE,
      value: requiresScopedFamily ? scopeFamilyId : "",
      path: "/",
      maxAge: requiresScopedFamily ? 60 * 60 * 24 : 0,
      httpOnly: true,
      sameSite: "lax",
    });

    // Backward-compatible cookie for existing checks.
    response.cookies.set({
      name: DEV_SUPER_ADMIN_DISABLED_COOKIE,
      value: roleMode === "SUPER_ADMIN" ? "0" : "1",
      path: "/",
      maxAge: roleMode === "SUPER_ADMIN" ? 0 : 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Error toggling dev super admin mode:", error);
    return NextResponse.json(
      { error: "Failed to update dev super admin mode" },
      { status: 500 }
    );
  }
}
