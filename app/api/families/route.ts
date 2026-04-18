import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as familyService from "@/lib/services/family";

export const runtime = "nodejs";

function parseFamilySort(value: string | null): familyService.FamilySortMode {
  if (value === "members-asc") {
    return "MEMBERS_ASC";
  }

  if (value === "name-asc") {
    return "NAME_ASC";
  }

  return "MEMBERS_DESC";
}

/**
 * GET /api/families
 * Fetch families from a village
 * Query params:
 * - villageId: Get all families in a village (required)
 * - search: Search by family name
 * - includeStats: Whether to include family statistics
 * - sort: members-desc | members-asc | name-asc
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
    const villageId = searchParams.get("villageId");
    const search = searchParams.get("search")?.trim();
    const sort = parseFamilySort(searchParams.get("sort"));
    const includeStats = searchParams.get("includeStats") === "true";
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const page = pageParam ? Number(pageParam) : undefined;
    const pageSize = pageSizeParam ? Number(pageSizeParam) : undefined;
    const usePagination = Number.isFinite(page) || Number.isFinite(pageSize);

    if (!villageId) {
      return NextResponse.json(
        { error: "villageId is required" },
        { status: 400 }
      );
    }

    if (usePagination) {
      const paged = await familyService.getVillageFamiliesPaginated(villageId, {
        search,
        page,
        pageSize,
        sort,
      });

      let items = paged.items;

      if (includeStats) {
        items = await Promise.all(
          paged.items.map(async (family: any) => {
            const stats = await familyService.getFamilyStats(family.id);
            return {
              ...family,
              stats,
            };
          })
        );
      }

      return NextResponse.json(
        {
          data: {
            items,
            total: paged.total,
            page: paged.page,
            pageSize: paged.pageSize,
            totalPages: paged.totalPages,
          },
        },
        { status: 200 }
      );
    }

    const families = await familyService.getVillageFamilies(villageId, search, sort);

    // Optionally add statistics to each family
    if (includeStats) {
      const familiesWithStats = await Promise.all(
        families.map(async (family: any) => {
          const stats = await familyService.getFamilyStats(family.id);
          return {
            ...family,
            stats,
          };
        })
      );

      return NextResponse.json({ data: familiesWithStats }, { status: 200 });
    }

    return NextResponse.json({ data: families }, { status: 200 });
  } catch (error) {
    console.error("Error fetching families:", error);
    return NextResponse.json(
      { error: "Failed to fetch families" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/families
 * Create a new family in a village
 * Requires authentication
 * Body:
 * - name: Family name
 * - slug: URL-friendly slug
 * - villageId: Parent village ID
 * - description: Optional family description
 * - photoUrl: Optional family photo
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
    const { name, slug, villageId, description, photoUrl } = body;

    // Validate required fields
    if (!name || !slug || !villageId) {
      return NextResponse.json(
        { error: "name, slug, and villageId are required" },
        { status: 400 }
      );
    }

    const canCreateFamily = await familyService.userCanCreateFamilyInVillage(
      userId,
      villageId
    );
    if (!canCreateFamily) {
      return NextResponse.json(
        {
          error:
            "Forbidden: only Super Admin or village-wide family manager can create families",
        },
        { status: 403 }
      );
    }

    // Validate slug format (lowercase alphanumeric + hyphens only)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        {
          error:
            "slug must be lowercase alphanumeric with hyphens only (e.g., 'family-name')",
        },
        { status: 400 }
      );
    }

    // Check if slug is unique in the village
    const isUnique = await familyService.isSlugUnique(villageId, slug);

    if (!isUnique) {
      return NextResponse.json(
        { error: "slug must be unique within the village" },
        { status: 409 }
      );
    }

    const family = await familyService.createFamily({
      name,
      slug,
      villageId,
      description,
      photoUrl,
    });

    // Add the creating user as admin
    await familyService.addFamilyAdmin(family.id, userId, "admin");

    return NextResponse.json({ data: family }, { status: 201 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create family";

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

    console.error("Error creating family:", error);
    return NextResponse.json(
      { error: "Failed to create family" },
      { status: 500 }
    );
  }
}
