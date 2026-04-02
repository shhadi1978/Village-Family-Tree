import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const baseConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!baseConnectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL is not defined");
  }

  const parsedUrl = new URL(baseConnectionString);

  // Let `pg` SSL options control TLS behavior in local dev.
  parsedUrl.searchParams.delete("sslmode");
  parsedUrl.searchParams.delete("channel_binding");
  parsedUrl.searchParams.delete("pgbouncer");

  const adapter = new PrismaPg({
    connectionString: parsedUrl.toString(),
    ssl: { rejectUnauthorized: false },
  });

  return new PrismaClient({ adapter });
}

/**
 * Singleton Prisma Client instance
 * Prevents multiple instances in development (which would cause connection pool issues)
 * In production, a single instance is created and reused
 */
export const db = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
