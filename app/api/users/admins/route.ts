import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isSuperAdmin } from "@/lib/authz";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserSummary = {
  clerkId: string;
  fullName: string;
  email: string;
  imageUrl?: string;
  assignmentsCount: number;
  families: Array<{ id: string; name: string; role: string }>;
};

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const villageId = (searchParams.get("villageId") || "").trim();
    const query = (searchParams.get("q") || "").trim().toLowerCase();

    if (!villageId) {
      return NextResponse.json(
        { error: "villageId is required" },
        { status: 400 }
      );
    }

    const adminMappings = await db.familyAdmin.findMany({
      where: {
        family: {
          villageId,
        },
      },
      include: {
        family: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          family: {
            name: "asc",
          },
        },
      ],
    });

    const uniqueClerkIds = [...new Set(adminMappings.map((item) => item.clerkId))];

    if (uniqueClerkIds.length === 0) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    const client = await clerkClient();
    const usersResult = await client.users.getUserList({
      userId: uniqueClerkIds,
      limit: uniqueClerkIds.length,
    });

    const usersById = new Map(
      usersResult.data.map((user) => {
        const primaryEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId
        );
        const fallbackEmail = user.emailAddresses[0];
        const firstName = user.firstName || "";
        const lastName = user.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim() || user.username || "مستخدم بدون اسم";

        return [
          user.id,
          {
            fullName,
            email: primaryEmail?.emailAddress || fallbackEmail?.emailAddress || "",
            imageUrl: user.imageUrl,
          },
        ];
      })
    );

    const summariesMap = new Map<string, UserSummary>();

    for (const mapping of adminMappings) {
      const userMeta = usersById.get(mapping.clerkId);
      const searchableText = `${userMeta?.fullName || ""} ${userMeta?.email || ""} ${mapping.clerkId}`.toLowerCase();

      if (query && !searchableText.includes(query)) {
        continue;
      }

      const current = summariesMap.get(mapping.clerkId) || {
        clerkId: mapping.clerkId,
        fullName: userMeta?.fullName || "مستخدم غير معروف",
        email: userMeta?.email || "",
        imageUrl: userMeta?.imageUrl,
        assignmentsCount: 0,
        families: [],
      };

      current.assignmentsCount += 1;
      current.families.push({
        id: mapping.familyId,
        name: mapping.family?.name || "عائلة غير معروفة",
        role: mapping.role,
      });

      summariesMap.set(mapping.clerkId, current);
    }

    const summaries = [...summariesMap.values()].sort((a, b) => {
      if (b.assignmentsCount !== a.assignmentsCount) {
        return b.assignmentsCount - a.assignmentsCount;
      }

      return a.fullName.localeCompare(b.fullName, "ar");
    });

    return NextResponse.json({ data: summaries }, { status: 200 });
  } catch (error) {
    console.error("Error loading admin users summary:", error);
    return NextResponse.json(
      { error: "Failed to load admin users summary" },
      { status: 500 }
    );
  }
}