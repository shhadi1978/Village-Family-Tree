import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isSuperAdmin } from "@/lib/authz";
import * as familyService from "@/lib/services/family";

export const runtime = "nodejs";

/**
 * GET /api/families/[familyId]/admins
 * List all admins for a family
 * Super Admin only
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { familyId: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!isSuperAdmin(userId)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin only" },
        { status: 403 }
      );
    }

    const admins = await db.familyAdmin.findMany({
      where: { familyId: params.familyId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data: admins }, { status: 200 });
  } catch (error) {
    console.error("Error listing family admins:", error);
    return NextResponse.json(
      { error: "Failed to list family admins" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/families/[familyId]/admins
 * Add/assign a family admin
 * Super Admin only
 * Body: { clerkId: string, role?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { familyId: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!isSuperAdmin(userId)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin only" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const clerkId = typeof body?.clerkId === "string" ? body.clerkId.trim() : "";
    const role = typeof body?.role === "string" && body.role.trim().length > 0
      ? body.role.trim()
      : "admin";

    if (!clerkId) {
      return NextResponse.json(
        { error: "clerkId is required" },
        { status: 400 }
      );
    }

    const familyExists = await familyService.familyExists(params.familyId);
    if (!familyExists) {
      return NextResponse.json(
        { error: "Family not found" },
        { status: 404 }
      );
    }

    const admin = await familyService.addFamilyAdmin(params.familyId, clerkId, role);

    return NextResponse.json({ data: admin }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding family admin:", error);
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "This user is already an admin for this family" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to add family admin" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/families/[familyId]/admins
 * Remove a family admin
 * Super Admin only
 * Body: { clerkId: string }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { familyId: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!isSuperAdmin(userId)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin only" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const clerkId = typeof body?.clerkId === "string" ? body.clerkId.trim() : "";

    if (!clerkId) {
      return NextResponse.json(
        { error: "clerkId is required" },
        { status: 400 }
      );
    }

    const deleted = await familyService.removeFamilyAdmin(params.familyId, clerkId);

    if (!deleted.count) {
      return NextResponse.json(
        { error: "Family admin mapping not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { removed: true } }, { status: 200 });
  } catch (error) {
    console.error("Error removing family admin:", error);
    return NextResponse.json(
      { error: "Failed to remove family admin" },
      { status: 500 }
    );
  }
}
