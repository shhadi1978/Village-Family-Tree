import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isSuperAdmin } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchUser = {
  clerkId: string;
  fullName: string;
  email: string;
  imageUrl?: string;
};

/**
 * GET /api/users/search?q=<query>&limit=<n>
 * Search Clerk users for admin assignment picker.
 * Super Admin only.
 */
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
    const query = (searchParams.get("q") || "").trim();
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 25)
      : 10;

    const client = await clerkClient();
    const result = await client.users.getUserList({
      query: query.length > 0 ? query : undefined,
      limit,
    });

    const users: SearchUser[] = result.data.map((user) => {
      const firstName = user.firstName || "";
      const lastName = user.lastName || "";
      const name = `${firstName} ${lastName}`.trim();
      const primaryEmail = user.emailAddresses.find(
        (email) => email.id === user.primaryEmailAddressId
      );
      const fallbackEmail = user.emailAddresses[0];

      return {
        clerkId: user.id,
        fullName: name || user.username || "مستخدم بدون اسم",
        email: primaryEmail?.emailAddress || fallbackEmail?.emailAddress || "",
        imageUrl: user.imageUrl,
      };
    });

    return NextResponse.json({ data: users }, { status: 200 });
  } catch (error) {
    console.error("Error searching Clerk users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
