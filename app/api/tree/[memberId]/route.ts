import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchFamilyTree, fetchFocusedFamilyTree } from "@/lib/tree-logic";

export const runtime = "nodejs";

/**
 * GET /api/tree/[memberId]
 * Fetch recursive family tree starting from a member
 * Query params:
 * - depth: Maximum tree depth (default: 5, max: 10)
 * - view: full | descendants (default: full)
 * - showParents: true | false
 * - showSiblings: true | false
 * - showDescendants: true | false
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
    const { searchParams } = new URL(req.url);
    const depthStr = searchParams.get("depth");
    const viewParam = String(searchParams.get("view") || "full").toLowerCase();
    const showParentsParam = searchParams.get("showParents");
    const showSiblingsParam = searchParams.get("showSiblings");
    const showDescendantsParam = searchParams.get("showDescendants");

    let maxDepth = 5; // Default
    if (depthStr) {
      const parsed = parseInt(depthStr, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 10) {
        maxDepth = parsed;
      }
    }

    const hasFocusedOptions =
      showParentsParam !== null ||
      showSiblingsParam !== null ||
      showDescendantsParam !== null;

    const tree = hasFocusedOptions
      ? await fetchFocusedFamilyTree(memberId, maxDepth, {
          includeParents: showParentsParam !== "false",
          includeSiblings: showSiblingsParam !== "false",
          includeDescendants: showDescendantsParam !== "false",
        })
      : await fetchFamilyTree(
          memberId,
          maxDepth,
          new Set(),
          0,
          viewParam === "descendants" ? "DESCENDANTS" : "FULL"
        );

    if (!tree) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: tree }, { status: 200 });
  } catch (error) {
    console.error("Error fetching family tree:", error);
    return NextResponse.json(
      { error: "Failed to fetch family tree" },
      { status: 500 }
    );
  }
}
