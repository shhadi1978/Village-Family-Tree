import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as memberService from "@/lib/services/member";
import * as familyService from "@/lib/services/family";

export const runtime = "nodejs";

const ALLOWED_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

/**
 * GET /api/members
 * Fetch members from a family or search across a village
 * Query params:
 * - familyId: Get all members in a family
 * - villageId: Get all members in a village
 * - search: Search members by name (requires villageId)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const familyId = searchParams.get("familyId");
    const villageId = searchParams.get("villageId");
    const search = searchParams.get("search");
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const page = pageParam ? Number(pageParam) : undefined;
    const pageSize = pageSizeParam ? Number(pageSizeParam) : undefined;
    const usePagination = Number.isFinite(page) || Number.isFinite(pageSize);

    if (!familyId && !villageId) {
      return NextResponse.json(
        { error: "Either familyId or villageId is required" },
        { status: 400 }
      );
    }

    if (usePagination) {
      const paged = await memberService.getMembersPaginated({
        familyId,
        villageId,
        search,
        page,
        pageSize,
      });

      return NextResponse.json(
        {
          data: {
            items: paged.items,
            total: paged.total,
            page: paged.page,
            pageSize: paged.pageSize,
            totalPages: paged.totalPages,
          },
        },
        { status: 200 }
      );
    }

    let members;

    if (search && villageId) {
      members = await memberService.searchMembers(villageId, search);
    } else if (familyId) {
      members = await memberService.getFamilyMembers(familyId);
    } else if (villageId) {
      members = await memberService.getVillageMembers(villageId);
    }

    return NextResponse.json({ data: members }, { status: 200 });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/members
 * Create a new family member
 * Requires authentication and family admin rights
 * 
 * Body params:
 * - firstName, lastName, gender, familyId, villageId (required)
 * - parentId OR fatherId (for children) - creates parent relationship
 * - spouseId (for spouse) - creates spouse relationship
 * - Other optional: nickname, dateOfBirth, dateOfDeath, bio, photoUrl
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      nickname,
      gender,
      familyId,
      villageId,
      fatherId,
      motherId,
      parentId,
      spouseId,
      isFounder,
      dateOfBirth,
      dateOfDeath,
      bio,
      photoUrl,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !gender || !familyId || !villageId) {
      return NextResponse.json(
        {
          error:
            "firstName, lastName, gender, familyId, and villageId are required",
        },
        { status: 400 }
      );
    }

    if (isFounder) {
      return NextResponse.json(
        { error: "لا يمكن إنشاء المؤسس يدويًا. يتم إنشاؤه تلقائيًا عند إنشاء العائلة." },
        { status: 400 }
      );
    }

    // Either parentId/fatherId (for children) or spouseId (for spouse) must be provided
    if (!parentId && !fatherId && !spouseId) {
      return NextResponse.json(
        { error: "Either parentId, fatherId, or spouseId is required" },
        { status: 400 }
      );
    }

    // Validate gender enum
    if (!ALLOWED_GENDERS.includes(gender)) {
      return NextResponse.json(
        { error: "Invalid gender value" },
        { status: 400 }
      );
    }

    const canCreateMember = await familyService.userHasFamilyPermission(
      userId,
      familyId,
      "member:create"
    );

    if (!canCreateMember) {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to add members to this family" },
        { status: 403 }
      );
    }

    // Create member with appropriate relationship
    const resolvedParentId = parentId || fatherId;
    const memberData = {
      firstName,
      lastName,
      nickname: typeof nickname === "string" ? nickname.trim() || undefined : undefined,
      gender,
      familyId,
      villageId,
      fatherId: spouseId ? undefined : resolvedParentId,
      motherId: undefined,
      isFounder: false,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      dateOfDeath: dateOfDeath ? new Date(dateOfDeath) : undefined,
      bio,
      photoUrl,
    };

    let member;
    
    if (spouseId) {
      // Creating spouse: just create the member without parent relationship
      member = await memberService.createMember({
        ...memberData,
        fatherId: undefined,
      });

      // Create spouse relationship
      const relationshipService = await import("@/lib/services/relationship");
      await relationshipService.createRelationship({
        fromMemberId: spouseId,
        toMemberId: member.id,
        type: "SPOUSE",
        villageId,
      });
    } else {
      // Creating child: use existing logic
      member = await memberService.createMember(memberData as any);
    }

    return NextResponse.json({ data: member }, { status: 201 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create member";

    const isMissingFounderColumn =
      errorMessage.includes("isFounder") &&
      (errorMessage.toLowerCase().includes("does not exist") ||
        errorMessage.includes("P2022"));

    if (isMissingFounderColumn) {
      return NextResponse.json(
        {
          error:
            "حقل المؤسس isFounder غير موجود بعد في قاعدة البيانات. شغّل prisma db push أو migration أولاً.",
        },
        { status: 500 }
      );
    }

    const status = errorMessage.includes("already exists") ||
      errorMessage.includes("parentId") ||
      errorMessage.includes("fatherId") ||
      errorMessage.includes("Founder") ||
      errorMessage.includes("Father") ||
      errorMessage.includes("Mother")
      ? 400
      : 500;

    console.error("Error creating member:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}
