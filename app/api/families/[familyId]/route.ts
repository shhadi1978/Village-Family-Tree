import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as familyService from "@/lib/services/family";

export const runtime = "nodejs";

/**
 * GET /api/families/[familyId]
 * Fetch a specific family with all members and stats
 * Public endpoint - no auth required
 */
export async function GET(
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

    const { familyId } = params;

    const family = await familyService.getFamilyWithMembers(familyId);

    if (!family) {
      return NextResponse.json(
        { error: "Family not found" },
        { status: 404 }
      );
    }

    // Include statistics
    const stats = await familyService.getFamilyStats(familyId);

    return NextResponse.json(
      { data: { ...family, stats } },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching family:", error);
    return NextResponse.json(
      { error: "Failed to fetch family" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/families/[familyId]
 * Update a family
 * Requires authentication and family admin rights
 */
export async function PUT(
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

    const { familyId } = params;

    const canUpdateFamily = await familyService.userHasFamilyPermission(
      userId,
      familyId,
      "family:update"
    );

    if (!canUpdateFamily) {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to update this family" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, slug, description, photoUrl } = body;

    // If slug is changed, validate uniqueness
    if (slug) {
      const family = await familyService.getFamily(familyId);
      if (family && family.slug !== slug) {
        const isUnique = await familyService.isSlugUnique(
          family.villageId,
          slug,
          familyId
        );

        if (!isUnique) {
          return NextResponse.json(
            { error: "slug must be unique within the village" },
            { status: 409 }
          );
        }

        // Validate slug format
        const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!slugRegex.test(slug)) {
          return NextResponse.json(
            {
              error:
                "slug must be lowercase alphanumeric with hyphens only",
            },
            { status: 400 }
          );
        }
      }
    }

    const updatedFamily = await familyService.updateFamily(familyId, {
      ...(name && { name }),
      ...(slug && { slug }),
      ...(description !== undefined && { description }),
      ...(photoUrl !== undefined && { photoUrl }),
    });

    return NextResponse.json({ data: updatedFamily }, { status: 200 });
  } catch (error) {
    console.error("Error updating family:", error);
    return NextResponse.json(
      { error: "Failed to update family" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/families/[familyId]
 * Delete a family and all associated members and relationships
 * Requires authentication and family admin rights
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

    const { familyId } = params;

    const canDeleteFamily = await familyService.userHasFamilyPermission(
      userId,
      familyId,
      "family:delete"
    );

    if (!canDeleteFamily) {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to delete this family" },
        { status: 403 }
      );
    }

    const deletedFamily = await familyService.deleteFamily(familyId);

    return NextResponse.json(
      { data: deletedFamily, message: "Family deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting family:", error);
    return NextResponse.json(
      { error: "Failed to delete family" },
      { status: 500 }
    );
  }
}
