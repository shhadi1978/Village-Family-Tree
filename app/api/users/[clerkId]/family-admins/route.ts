import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isSuperAdmin } from "@/lib/authz";
import * as familyService from "@/lib/services/family";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { clerkId: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(userId)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin only" },
        { status: 403 }
      );
    }

    const targetClerkId = String(params.clerkId || "").trim();
    if (!targetClerkId) {
      return NextResponse.json(
        { error: "clerkId is required" },
        { status: 400 }
      );
    }

    const mappings = await familyService.getUserFamilyAdminMappings(targetClerkId);
    const { searchParams } = new URL(req.url);
    const villageId = searchParams.get("villageId")?.trim();

    const filtered = villageId
      ? mappings.filter((item) => item.family?.villageId === villageId)
      : mappings;

    return NextResponse.json({ data: filtered }, { status: 200 });
  } catch (error) {
    console.error("Error loading user family admin mappings:", error);
    return NextResponse.json(
      { error: "Failed to load user family admin mappings" },
      { status: 500 }
    );
  }
}