import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isSuperAdmin } from "@/lib/authz";

export const runtime = "nodejs";

type Params = { params: { villageId: string } };

/**
 * GET /api/villages/[villageId]
 * Returns a single village with families and member counts.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const village = await db.village.findUnique({
      where: { id: params.villageId },
      include: {
        families: {
          include: { _count: { select: { members: true } } },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { families: true, members: true } },
      },
    });

    if (!village) {
      return NextResponse.json({ error: "القرية غير موجودة" }, { status: 404 });
    }

    return NextResponse.json({ data: village }, { status: 200 });
  } catch (error) {
    console.error(`GET /api/villages/${params.villageId} error:`, error);
    return NextResponse.json({ error: "Failed to fetch village" }, { status: 500 });
  }
}

/**
 * PATCH /api/villages/[villageId]
 * Update village name / description / photoUrl.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSuperAdmin(userId)) {
      return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, photoUrl } = body;

    const village = await db.village.update({
      where: { id: params.villageId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(photoUrl !== undefined ? { photoUrl: photoUrl || null } : {}),
      },
    });

    return NextResponse.json({ data: village }, { status: 200 });
  } catch (error: any) {
    console.error(`PATCH /api/villages/${params.villageId} error:`, error);
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "القرية غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update village" }, { status: 500 });
  }
}

/**
 * DELETE /api/villages/[villageId]
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSuperAdmin(userId)) {
      return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
    }

    await db.village.delete({ where: { id: params.villageId } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error(`DELETE /api/villages/${params.villageId} error:`, error);
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "القرية غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete village" }, { status: 500 });
  }
}
