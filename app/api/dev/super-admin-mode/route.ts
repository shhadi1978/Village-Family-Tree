import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  DEV_ROLE_OVERRIDE_COOKIE,
  DEV_SUPER_ADMIN_DISABLED_COOKIE,
  DevRoleOverride,
  getDevRoleOverrideByCookie,
  isConfiguredSuperAdmin,
  isDevSuperAdminDisabledByCookie,
  isSuperAdmin,
} from "@/lib/authz";

export const runtime = "nodejs";

function isDevMode(): boolean {
  return process.env.NODE_ENV !== "production";
}

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
          isDev: isDevMode(),
          isConfiguredSuperAdmin: configuredSuperAdmin,
          roleMode,
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
 * Body: { roleMode: "SUPER_ADMIN" | "FAMILY_ADMIN" | "VIEWER" }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isDevMode()) {
      return NextResponse.json(
        { error: "Dev Role Switcher is disabled in production" },
        { status: 403 }
      );
    }

    if (!isConfiguredSuperAdmin(userId)) {
      return NextResponse.json(
        { error: "Only configured super admin can use this switch" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const roleMode = body?.roleMode as DevRoleOverride | undefined;

    if (
      roleMode !== "SUPER_ADMIN" &&
      roleMode !== "FAMILY_ADMIN" &&
      roleMode !== "VIEWER"
    ) {
      return NextResponse.json(
        { error: "roleMode is required (SUPER_ADMIN | FAMILY_ADMIN | VIEWER)" },
        { status: 400 }
      );
    }

    const response = NextResponse.json(
      {
        data: {
          isDev: true,
          isConfiguredSuperAdmin: true,
          roleMode,
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
