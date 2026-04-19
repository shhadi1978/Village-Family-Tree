import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as memberService from "@/lib/services/member";
import * as familyService from "@/lib/services/family";

export const runtime = "nodejs";

const ALLOWED_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

function isDatabaseAccessDeniedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();

  return (
    message.includes("P1010") ||
    lower.includes("denied access on the database") ||
    lower.includes("permission denied for database")
  );
}

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

    if (isDatabaseAccessDeniedError(error)) {
      return NextResponse.json(
        {
          error:
            "تعذر الوصول إلى قاعدة البيانات (Database access denied). تحقق من DATABASE_URL / DIRECT_URL وصلاحيات المستخدم على قاعدة البيانات.",
        },
        { status: 503 }
      );
    }

    const details = error instanceof Error ? error.message : String(error || "");

    return NextResponse.json(
      {
        error: "Failed to fetch members",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
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
      isExternal,
      externalOriginText,
      externalNotes,
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
    if (!firstName || !lastName || !gender || !villageId) {
      return NextResponse.json(
        {
          error:
            "firstName, lastName, gender, and villageId are required",
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

    const wantsExternalSpouse = Boolean(isExternal) && Boolean(spouseId);

    let resolvedFamilyId = familyId as string | undefined;
    let spouseMember: Awaited<ReturnType<typeof memberService.getMember>> | null = null;

    if (spouseId) {
      spouseMember = await memberService.getMember(spouseId);
      if (!spouseMember) {
        return NextResponse.json(
          { error: "العضو المراد إضافة زوج/زوجة له غير موجود" },
          { status: 404 }
        );
      }

      if (spouseMember.villageId !== villageId) {
        return NextResponse.json(
          { error: "يجب أن يكون الزوج/الزوجة في نفس القرية" },
          { status: 400 }
        );
      }

      if (
        (spouseMember.gender === "MALE" && gender === "MALE") ||
        (spouseMember.gender === "FEMALE" && gender === "FEMALE")
      ) {
        return NextResponse.json(
          { error: "لا يمكن إضافة زوج إلى زوج أو زوجة إلى زوجة" },
          { status: 400 }
        );
      }

      // Permission should be based on the spouse's family (the family user is editing).
      const canCreateSpouse = await familyService.userHasFamilyPermission(
        userId,
        spouseMember.familyId,
        "member:create"
      );

      if (!canCreateSpouse) {
        return NextResponse.json(
          { error: "Unauthorized: You do not have permission to add spouse members to this family" },
          { status: 403 }
        );
      }

      if (wantsExternalSpouse) {
        const externalFamily = await familyService.ensureExternalFamilyForVillage(
          villageId
        );
        resolvedFamilyId = externalFamily.id;
      } else {
        resolvedFamilyId = resolvedFamilyId || spouseMember.familyId;
      }
    } else {
      if (!resolvedFamilyId) {
        return NextResponse.json(
          { error: "familyId is required when creating non-spouse members" },
          { status: 400 }
        );
      }

      const canCreateMember = await familyService.userHasFamilyPermission(
        userId,
        resolvedFamilyId,
        "member:create"
      );

      if (!canCreateMember) {
        return NextResponse.json(
          { error: "Unauthorized: You do not have permission to add members to this family" },
          { status: 403 }
        );
      }
    }

    // Create member with appropriate relationship
    const resolvedParentId = parentId || fatherId;
    const memberData = {
      firstName,
      lastName,
      nickname: typeof nickname === "string" ? nickname.trim() || undefined : undefined,
      gender,
      familyId: resolvedFamilyId!,
      villageId,
      isExternal: wantsExternalSpouse,
      spouseId: spouseId || undefined,
      externalOriginText:
        typeof externalOriginText === "string" ? externalOriginText.trim() || undefined : undefined,
      externalNotes:
        typeof externalNotes === "string" ? externalNotes.trim() || undefined : undefined,
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

    if (isDatabaseAccessDeniedError(error)) {
      return NextResponse.json(
        {
          error:
            "تعذر الوصول إلى قاعدة البيانات (Database access denied). تحقق من DATABASE_URL / DIRECT_URL وصلاحيات المستخدم على قاعدة البيانات.",
        },
        { status: 503 }
      );
    }

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
