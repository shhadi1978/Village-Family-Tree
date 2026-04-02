import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result: Record<string, unknown> = {
    ok: true,
    env: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      DIRECT_URL: Boolean(process.env.DIRECT_URL),
      CLERK_SECRET_KEY: Boolean(process.env.CLERK_SECRET_KEY),
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
      UPLOADTHING_SECRET: Boolean(process.env.UPLOADTHING_SECRET),
      UPLOADTHING_APP_ID: Boolean(process.env.UPLOADTHING_APP_ID),
      SUPER_ADMIN_CLERK_IDS: Boolean(process.env.SUPER_ADMIN_CLERK_IDS),
      NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    },
  };

  try {
    const { userId } = await auth();
    result.auth = { ok: true, hasUser: Boolean(userId) };
  } catch (error) {
    result.ok = false;
    result.auth = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    const { db } = await import("@/lib/db");
    await db.$queryRaw`SELECT 1`;
    result.db = { ok: true };
  } catch (error) {
    result.ok = false;
    result.db = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
  });
}
