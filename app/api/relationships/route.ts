import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as relationshipService from "@/lib/services/relationship";
import * as familyService from "@/lib/services/family";
import * as memberService from "@/lib/services/member";

export const runtime = "nodejs";

type RelationshipTypeValue = "PARENT" | "SPOUSE";
const ALLOWED_RELATIONSHIP_TYPES: RelationshipTypeValue[] = ["PARENT", "SPOUSE"];

function mapRelationshipCreateError(message: string): string {
  if (message.includes("not found")) {
    return "لم يتم العثور على أحد الأفراد المحددين.";
  }
  if (message.includes("Circular")) {
    return "لا يمكن إنشاء علاقة أبوة/أمومة عكسية لأنها تسبب دورة غير صالحة.";
  }
  if (message.includes("same village")) {
    return "يجب أن يكون الطرفان من نفس القرية.";
  }
  if (message.includes("same family")) {
    return "يجب أن يكون الأب من نفس عائلة الابن/الابنة.";
  }
  if (message.includes("one father")) {
    return "لكل فرد أب واحد فقط.";
  }
  if (message.includes("one mother")) {
    return "لكل فرد أم واحدة فقط.";
  }
  if (
    message.includes("already exists") ||
    message.includes("selected member IDs") ||
    message.includes("P2002") ||
    message.includes("Unique constraint")
  ) {
    return "هذه العلاقة موجودة بالفعل بين المعرّفين المحددين.";
  }
  if (message.includes("male or female")) {
    return "يجب أن يكون الوالد المحدد ذكراً أو أنثى.";
  }
  if (message.includes("Father must")) {
    return "يجب أن يكون الأب من نفس العائلة.";
  }
  if (message.includes("Spouse relationship requires male and female")) {
    return "علاقة الزواج تتطلب طرفين من ذكر وأنثى.";
  }
  if (message.includes("Spouse relationship requires opposite genders")) {
    return "لا يمكن إنشاء علاقة زوجية بين نفس الجنس.";
  }
  if (message.includes("Forbidden mahram relation")) {
    return "لا يمكن إنشاء علاقة زوجية بين المحارم (مثل الأب/الابنة، الأم/الابن، الأخ/الأخت، العم/الخال مع بنت الأخ/الأخت أو العمة/الخالة مع ابن الأخ/الأخت).";
  }
  if (message.includes("Forbidden in-law relation: spouse of ascendant/descendant")) {
    return "لا يمكن الزواج بسبب المصاهرة: زوجة الأب/الجد أو زوجة الابن/الحفيد أو ما في حكمهم.";
  }
  if (message.includes("Forbidden in-law relation: parent/child of existing spouse")) {
    return "لا يمكن الزواج بسبب المصاهرة: أم/أب الزوجة أو بنت/ابن الزوجة (أو ما في حكمهم).";
  }
  if (message.includes("Forbidden temporary relation: combining siblings in marriage")) {
    return "لا يجوز الجمع بين الأختين في الزواج.";
  }
  if (message.includes("Forbidden temporary relation: combining aunt/uncle with niece/nephew")) {
    return "لا يجوز الجمع بين المرأة وعمتها أو خالتها (وكذلك النظير بالعكس).";
  }

  return "تعذر إنشاء العلاقة.";
}

/**
 * GET /api/relationships
 * Fetch relationships for a member
 * Query params:
 * - memberId: Get all relationships for a member (both directions)
 * - type: Filter by relationship type (PARENT, SPOUSE)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "غير مصرح" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    const type = searchParams.get("type") as RelationshipTypeValue | null;

    if (!memberId) {
      return NextResponse.json(
        { error: "حقل memberId مطلوب" },
        { status: 400 }
      );
    }

    let relationships;

    if (type === "PARENT") {
      relationships = {
        parents: await relationshipService.getParentRelationships(memberId),
        children: await relationshipService.getChildRelationships(memberId),
      };
    } else if (type === "SPOUSE") {
      relationships = {
        spouses: await relationshipService.getSpouseRelationships(memberId),
      };
    } else {
      relationships = await relationshipService.getMemberRelationships(memberId);
    }

    return NextResponse.json({ data: relationships }, { status: 200 });
  } catch (error) {
    console.error("Error fetching relationships:", error);
    return NextResponse.json(
      { error: "تعذر تحميل العلاقات" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/relationships
 * Create a relationship between two members
 * Requires authentication and admin rights for both members' families
 * Body:
 * - fromMemberId: The source member
 * - toMemberId: The target member
 * - type: PARENT or SPOUSE
 * - villageId: The village ID
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "غير مصرح" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { fromMemberId, toMemberId, type, villageId, replaceExistingParent, marriageId } = body;

    // Validate required fields
    if (!fromMemberId || !toMemberId || !type || !villageId) {
      return NextResponse.json(
        { error: "الحقول fromMemberId و toMemberId و type و villageId مطلوبة" },
        { status: 400 }
      );
    }

    // Validate type enum
    if (!ALLOWED_RELATIONSHIP_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "نوع العلاقة غير صالح" },
        { status: 400 }
      );
    }

    // Prevent self-relationships
    if (fromMemberId === toMemberId) {
      return NextResponse.json(
        { error: "لا يمكن ربط الفرد بنفسه" },
        { status: 400 }
      );
    }

    // Get both members to verify they exist and get their families
    const [fromMember, toMember] = await Promise.all([
      memberService.getMember(fromMemberId),
      memberService.getMember(toMemberId),
    ]);

    if (!fromMember || !toMember) {
      return NextResponse.json(
        { error: "لم يتم العثور على أحد الأفراد أو كليهما" },
        { status: 404 }
      );
    }

    const [canEditFromFamily, canEditToFamily] = await Promise.all([
      familyService.userHasFamilyPermission(
        userId,
        fromMember.familyId,
        "relationship:create"
      ),
      familyService.userHasFamilyPermission(
        userId,
        toMember.familyId,
        "relationship:create"
      ),
    ]);

    const canCreateRequestedRelationship =
      type === "SPOUSE"
        ? canEditFromFamily || canEditToFamily
        : canEditFromFamily && canEditToFamily;

    if (!canCreateRequestedRelationship) {
      return NextResponse.json(
        {
          error:
            type === "SPOUSE"
              ? "غير مصرح: تحتاج صلاحية تعديل العلاقات في عائلة واحدة على الأقل"
              : "غير مصرح: يجب أن تملك صلاحية تعديل العلاقات في كلتا العائلتين",
        },
        { status: 403 }
      );
    }

    const relationship = await relationshipService.createRelationship({
      fromMemberId,
      toMemberId,
      type,
      villageId,
      replaceExistingParent: Boolean(replaceExistingParent),
      marriageId: typeof marriageId === "string" ? marriageId.trim() || null : null,
    });

    return NextResponse.json({ data: relationship }, { status: 201 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "تعذر إنشاء العلاقة";

    // Return 400 for validation errors, 500 for server errors
    const status = errorMessage.includes("not found") ||
      errorMessage.includes("Circular") ||
      errorMessage.includes("same village") ||
      errorMessage.includes("same family") ||
      errorMessage.includes("one father") ||
      errorMessage.includes("one mother") ||
      errorMessage.includes("already exists") ||
      errorMessage.includes("selected member IDs") ||
      errorMessage.includes("P2002") ||
      errorMessage.includes("Unique constraint") ||
      errorMessage.includes("male or female") ||
      errorMessage.includes("Father must") ||
      errorMessage.includes("Spouse relationship requires") ||
      errorMessage.includes("Forbidden mahram relation") ||
      errorMessage.includes("Forbidden in-law relation") ||
      errorMessage.includes("Forbidden temporary relation")
      ? 400
      : 500;

    console.error("Error creating relationship:", error);
    return NextResponse.json(
      { error: mapRelationshipCreateError(errorMessage) },
      { status }
    );
  }
}
