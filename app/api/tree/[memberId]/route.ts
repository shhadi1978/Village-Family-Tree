import { NextRequest, NextResponse } from "next/server";
import { fetchFamilyTree, fetchFocusedFamilyTree } from "@/lib/tree-logic";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60 seconds for long-running queries

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
    const memberId = params?.memberId;
    
    if (!memberId) {
      return NextResponse.json(
        { error: "Member ID is required" },
        { status: 400 }
      );
    }
    
    console.log(`[Tree API] Request for member: ${memberId}`);

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

    const fetchStartTime = Date.now();
    console.log(`[Tree API] Starting tree fetch with depth=${maxDepth}, view=${viewParam}`);
    
    let tree;
    try {
      tree = hasFocusedOptions
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
    } catch (fetchErr) {
      console.error("[Tree API] Error during tree fetch:", fetchErr);
      throw fetchErr;
    }
    
    const fetchTime = Date.now() - fetchStartTime;
    console.log(`[Tree API] Tree fetch completed in ${fetchTime}ms`);

    if (!tree) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: tree }, { status: 200 });
  } catch (error) {
    console.error("[Tree API] Error fetching family tree:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch family tree";
    return NextResponse.json(
      { error: errorMessage, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
