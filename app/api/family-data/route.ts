import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [members, marriages, relationships] = await Promise.all([
      db.member.findMany(),
      db.marriage.findMany(),
      db.relationship.findMany()
    ]);

    return NextResponse.json({
      members,
      marriages,
      relationships
    });
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}