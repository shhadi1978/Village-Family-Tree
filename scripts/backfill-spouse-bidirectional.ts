/**
 * Backfill script: Ensure all SPOUSE relationships are stored bidirectionally.
 * Run with: npx tsx scripts/backfill-spouse-bidirectional.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Manually parse .env.local before any imports that need it
const envPath = resolve(process.cwd(), ".env.local");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const match = line.match(/^([A-Z_]+)="?([^"#\r\n]+)"?/);
  if (match) process.env[match[1]] = match[2].trim();
}

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const url = new URL(connStr);
url.searchParams.delete("sslmode");
url.searchParams.delete("channel_binding");
url.searchParams.delete("pgbouncer");

const adapter = new PrismaPg({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter } as any);

async function main() {
  console.log("Loading all SPOUSE relationships...");

  const allSpouseRels = await db.relationship.findMany({
    where: { type: "SPOUSE" },
    select: {
      id: true,
      fromMemberId: true,
      toMemberId: true,
      villageId: true,
      marriageId: true,
    },
  });

  console.log(`Found ${allSpouseRels.length} SPOUSE relationship(s) total.`);

  // Build a set of existing (from, to) pairs
  const existing = new Set(
    allSpouseRels.map((r) => `${r.fromMemberId}::${r.toMemberId}`)
  );

  let backfilled = 0;

  for (const rel of allSpouseRels) {
    const reverseKey = `${rel.toMemberId}::${rel.fromMemberId}`;
    if (!existing.has(reverseKey)) {
      console.log(
        `  → Creating reverse for: ${rel.fromMemberId} ↔ ${rel.toMemberId}`
      );
      await db.relationship.create({
        data: {
          fromMemberId: rel.toMemberId,
          toMemberId: rel.fromMemberId,
          type: "SPOUSE",
          villageId: rel.villageId,
          ...(rel.marriageId ? { marriageId: rel.marriageId } : {}),
        },
      });
      // Add to the set so we don't double-create in this run
      existing.add(reverseKey);
      backfilled++;
    }
  }

  console.log(`\nDone. Backfilled ${backfilled} missing reverse SPOUSE relationship(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
