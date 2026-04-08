import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as relationshipService from "@/lib/services/relationship";
import * as familyService from "@/lib/services/family";

export const runtime = "nodejs";

/**
 * DELETE /api/relationships/[relationshipId]
 * Delete a relationship
 * Requires authentication and admin rights for at least one of the members' families
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { relationshipId: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "غير مصرح" },
        { status: 401 }
      );
    }

    const { relationshipId } = params;

    // Get the relationship with member details
    const relationship = await relationshipService.getRelationshipWithMembers(
      relationshipId
    );

    if (!relationship) {
      return NextResponse.json(
        { error: "العلاقة غير موجودة" },
        { status: 404 }
      );
    }

    const [canDeleteFromFamily, canDeleteToFamily] = await Promise.all([
      familyService.userHasFamilyPermission(
        userId,
        relationship.fromMember.familyId,
        "relationship:delete"
      ),
      familyService.userHasFamilyPermission(
        userId,
        relationship.toMember.familyId,
        "relationship:delete"
      ),
    ]);

    if (!canDeleteFromFamily || !canDeleteToFamily) {
      return NextResponse.json(
        { error: "غير مصرح: يجب أن تملك صلاحية حذف العلاقات في كلتا العائلتين" },
        { status: 403 }
      );
    }

    // Father link is mandatory for every member.
    if (
      relationship.type === "PARENT" &&
      relationship.fromMember.gender === "MALE"
    ) {
      const childParents = await relationshipService.getParentRelationships(
        relationship.toMemberId
      );

      const fatherCount = childParents.filter(
        (rel: { fromMember: { gender: string } }) => rel.fromMember.gender === "MALE"
      ).length;

      if (fatherCount <= 1) {
        return NextResponse.json(
          { error: "لا يمكن حذف علاقة الأب الوحيدة لهذا الفرد" },
          { status: 400 }
        );
      }
    }

    const deletedRelationship = await relationshipService.deleteRelationship(
      relationshipId
    );

    return NextResponse.json(
      { data: deletedRelationship, message: "تم حذف العلاقة بنجاح" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting relationship:", error);
    return NextResponse.json(
      { error: "تعذر حذف العلاقة" },
      { status: 500 }
    );
  }
}
