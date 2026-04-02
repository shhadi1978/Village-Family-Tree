import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as memberService from "@/lib/services/member";
import * as familyService from "@/lib/services/family";
import { isSuperAdmin } from "@/lib/authz";

export const runtime = "nodejs";

const ALLOWED_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

/**
 * GET /api/members/[memberId]
 * Fetch a specific member with all their relationships
 * Public endpoint - no auth required
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { memberId } = params;

    const member = await memberService.getMemberWithRelationships(memberId);

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: member }, { status: 200 });
  } catch (error) {
    console.error("Error fetching member:", error);
    return NextResponse.json(
      { error: "Failed to fetch member" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/members/[memberId]
 * Update a member
 * Requires authentication and family admin rights
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { memberId } = params;

    // Get the member to check which family they belong to
    const member = await memberService.getMember(memberId);

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Check if user is admin of the family
    const isAdmin = isSuperAdmin(userId)
      ? true
      : await familyService.isUserFamilyAdmin(userId, member.familyId);

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Not a family admin" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { firstName, lastName, nickname, isFounder, gender, dateOfBirth, dateOfDeath, bio, photoUrl } = body;

    // Validate gender if provided
    if (gender && !ALLOWED_GENDERS.includes(gender)) {
      return NextResponse.json(
        { error: "Invalid gender value" },
        { status: 400 }
      );
    }

    if (isFounder !== undefined) {
      return NextResponse.json(
        {
          error:
            "لا يمكن تعديل حالة المؤسس يدويًا. يتم تعيينها تلقائيًا عند إنشاء العائلة.",
        },
        { status: 400 }
      );
    }

    const updatedMember = await memberService.updateMember(memberId, {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(nickname !== undefined && {
        nickname: typeof nickname === "string" ? nickname.trim() : null,
      }),
      ...(gender && { gender }),
      ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
      ...(dateOfDeath !== undefined && { dateOfDeath: dateOfDeath ? new Date(dateOfDeath) : null }),
      ...(bio !== undefined && { bio }),
      ...(photoUrl !== undefined && { photoUrl }),
    });

    return NextResponse.json({ data: updatedMember }, { status: 200 });
  } catch (error) {
    console.error("Error updating member:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to update member";

    const isMissingNicknameColumn =
      errorMessage.includes("nickname") &&
      (errorMessage.toLowerCase().includes("does not exist") ||
        errorMessage.includes("P2022"));

    const isMissingFounderColumn =
      errorMessage.includes("isFounder") &&
      (errorMessage.toLowerCase().includes("does not exist") ||
        errorMessage.includes("P2022"));

    if (isMissingNicknameColumn) {
      return NextResponse.json(
        {
          error:
            "حقل الكنية غير موجود بعد في قاعدة البيانات. شغّل prisma db push أو migration أولاً.",
        },
        { status: 500 }
      );
    }

    if (isMissingFounderColumn) {
      return NextResponse.json(
        {
          error:
            "حقل المؤسس isFounder غير موجود بعد في قاعدة البيانات. شغّل prisma db push أو migration أولاً.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage.includes("Member not found") ? 404 : 500 }
    );
  }
}

/**
 * DELETE /api/members/[memberId]
 * Delete a member and all associated relationships
 * Requires authentication and family admin rights
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { memberId } = params;

    // Get the member to check which family they belong to
    const member = await memberService.getMember(memberId);

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Check if user is admin of the family
    const isAdmin = isSuperAdmin(userId)
      ? true
      : await familyService.isUserFamilyAdmin(userId, member.familyId);

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Not a family admin" },
        { status: 403 }
      );
    }

    const deletedMember = await memberService.deleteMember(memberId);

    return NextResponse.json(
      { data: deletedMember, message: "Member deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting member:", error);
    return NextResponse.json(
      { error: "Failed to delete member" },
      { status: 500 }
    );
  }
}
