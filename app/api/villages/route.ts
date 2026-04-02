import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isSuperAdmin } from "@/lib/authz";

export const runtime = "nodejs";

function buildDbAccessErrorResponse() {
  return NextResponse.json(
    {
      error:
        "تعذر الاتصال بقاعدة البيانات. تحقق من صلاحيات مستخدم Neon على قاعدة neondb/schema public.",
    },
    { status: 503 }
  );
}

function isDbAccessDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = (error as { message?: string }).message || "";
  return message.includes("denied access") || message.includes("neondb.public");
}

function toSlug(name: string): string {
  const latin = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/--+/g, "-")
    .slice(0, 60);

  // If the name is purely non-Latin (e.g. Arabic), fall back to a timestamp slug
  return latin || `village-${Date.now()}`;
}

/**
 * GET /api/villages
 * Returns all villages (public read).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const villages = await db.village.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { families: true, members: true },
        },
      },
    });

    return NextResponse.json({ data: villages }, { status: 200 });
  } catch (error) {
    console.error("GET /api/villages error:", error);
    if (isDbAccessDenied(error)) {
      return buildDbAccessErrorResponse();
    }
    return NextResponse.json({ error: "Failed to fetch villages" }, { status: 500 });
  }
}

/**
 * POST /api/villages
 * Create a new village. Requires authentication.
 * Body: { name, description?, photoUrl? }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSuperAdmin(userId)) {
      return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, photoUrl } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "اسم القرية مطلوب" }, { status: 400 });
    }

    const slug = toSlug(name);
    // Ensure slug uniqueness by appending a timestamp if needed
    const existing = await db.village.findUnique({ where: { slug } });
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    const village = await db.village.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        description: description?.trim() || null,
        photoUrl: photoUrl || null,
      },
    });

    return NextResponse.json({ data: village }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/villages error:", error);
    if (isDbAccessDenied(error)) {
      return buildDbAccessErrorResponse();
    }
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "اسم القرية موجود بالفعل" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create village" }, { status: 500 });
  }
}
