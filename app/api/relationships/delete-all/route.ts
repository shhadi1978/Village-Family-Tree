import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/relationships/delete-all
 * Delete all relationships (parent, child, spouse) for a member
 * This removes the member from the tree view but doesn't delete the member itself
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { memberId } = body;

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required" },
        { status: 400 }
      );
    }

    // Verify member exists
    const member = await db.member.findUnique({
      where: { id: memberId },
      select: { id: true, familyId: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Delete all relationships where this member is involved
    const deletedRelationships = await db.relationship.deleteMany({
      where: {
        OR: [
          { fromMemberId: memberId },
          { toMemberId: memberId },
        ],
      },
    });

    return NextResponse.json(
      {
        data: {
          deletedRelationshipsCount: deletedRelationships.count,
          message: `تم حذف ${deletedRelationships.count} علاقات بنجاح`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting relationships:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to delete relationships";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
