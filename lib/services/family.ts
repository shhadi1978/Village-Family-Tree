import { db } from "@/lib/db";
import { getDevRoleOverrideByCookie } from "@/lib/authz";

export type FamilySortMode = "MEMBERS_DESC" | "MEMBERS_ASC" | "NAME_ASC";
export const ALL_FAMILIES_ADMIN_ROLE = "all_families_admin";

function buildFamilyOrderBy(sort: FamilySortMode = "MEMBERS_DESC") {
  if (sort === "MEMBERS_ASC") {
    return [
      {
        members: {
          _count: "asc" as const,
        },
      },
      { name: "asc" as const },
    ];
  }

  if (sort === "NAME_ASC") {
    return [{ name: "asc" as const }];
  }

  return [
    {
      members: {
        _count: "desc" as const,
      },
    },
    { name: "asc" as const },
  ];
}

function isUnknownFounderFieldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("Unknown argument `isFounder`") ||
    message.includes("Unknown arg `isFounder`")
  );
}

/**
 * Create a new family in a village
 */
export async function createFamily(
  data: {
    name: string;
    slug: string;
    villageId: string;
    description?: string;
    photoUrl?: string;
  }
) {
  const normalizedFamilyName = String(data.name || "").trim();

  return db.$transaction(async (tx: any) => {
    const family = await tx.family.create({ data });

    // Every family starts with a single founder member created automatically.
    const founderData = {
      firstName: normalizedFamilyName,
      lastName: normalizedFamilyName,
      fullName: `${normalizedFamilyName} ${normalizedFamilyName}`.trim(),
      gender: "MALE",
      isFounder: true,
      bio: `المؤسس الأول لعائلة ${normalizedFamilyName}`,
      familyId: family.id,
      villageId: family.villageId,
    };

    try {
      await tx.member.create({ data: founderData });
    } catch (err) {
      if (!isUnknownFounderFieldError(err)) {
        throw err;
      }

      const { isFounder: _ignored, ...legacyFounderData } = founderData;
      await tx.member.create({ data: legacyFounderData });
    }

    return family;
  });
}

/**
 * Get family by ID with all members
 */
export async function getFamilyWithMembers(familyId: string) {
  return db.family.findUnique({
    where: { id: familyId },
    include: {
      members: {
        orderBy: { fullName: "asc" },
      },
      village: true,
      admins: true,
    },
  });
}

/**
 * Get family by ID (basic info only)
 */
export async function getFamily(familyId: string) {
  return db.family.findUnique({
    where: { id: familyId },
  });
}

/**
 * Get family by village and slug
 */
export async function getFamilyBySlug(villageId: string, slug: string) {
  return db.family.findFirst({
    where: {
      villageId,
      slug,
    },
  });
}

/**
 * Get all families in a village
 */
export async function getVillageFamilies(
  villageId: string,
  search?: string | null,
  sort: FamilySortMode = "MEMBERS_DESC"
) {
  const normalizedSearch = search?.trim();

  return db.family.findMany({
    where: {
      villageId,
      ...(normalizedSearch
        ? {
            name: {
              contains: normalizedSearch,
              mode: "insensitive",
            },
          }
        : {}),
    },
    include: {
      _count: {
        select: { members: true },
      },
    },
    orderBy: buildFamilyOrderBy(sort),
  });
}

/**
 * Get paginated families in a village
 */
export async function getVillageFamiliesPaginated(
  villageId: string,
  options?: {
    search?: string | null;
    page?: number;
    pageSize?: number;
    sort?: FamilySortMode;
  }
) {
  const normalizedSearch = options?.search?.trim();
  const page = Math.max(1, Number(options?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options?.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const where = {
    villageId,
    ...(normalizedSearch
      ? {
          name: {
            contains: normalizedSearch,
            mode: "insensitive" as const,
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.family.findMany({
      where,
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: buildFamilyOrderBy(options?.sort || "MEMBERS_DESC"),
      skip,
      take: pageSize,
    }),
    db.family.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Update a family
 */
export async function updateFamily(
  familyId: string,
  data: Partial<{
    name: string;
    slug: string;
    description: string;
    photoUrl: string;
  }>
) {
  return db.family.update({
    where: { id: familyId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

/**
 * Delete a family and all associated members and relationships
 */
export async function deleteFamily(familyId: string) {
  return db.family.delete({
    where: { id: familyId },
  });
}

/**
 * Get family statistics (member count, age distribution, etc.)
 */
export async function getFamilyStats(familyId: string) {
  const [members, memberCount] = await Promise.all([
    db.member.findMany({
      where: { familyId },
      select: {
        gender: true,
        dateOfDeath: true,
      },
    }),
    db.member.count({
      where: { familyId },
    }),
  ]);

  const genderStats = members.reduce(
    (
      acc: Record<string, number>,
      member: { gender: string; dateOfDeath: Date | null }
    ) => {
      acc[member.gender] = (acc[member.gender] || 0) + 1;
      return acc;
    },
    {}
  );

  const livingCount = members.filter(
    (m: { dateOfDeath: Date | null }) => !m.dateOfDeath
  ).length;

  return {
    totalMembers: memberCount,
    livingMembers: livingCount,
    deceasedMembers: memberCount - livingCount,
    genderStats,
  };
}

/**
 * Add an admin to a family
 */
export async function addFamilyAdmin(
  familyId: string,
  clerkId: string,
  role: string = "admin"
) {
  return db.familyAdmin.create({
    data: {
      familyId,
      clerkId,
      role,
    },
  });
}

/**
 * Remove an admin from a family
 */
export async function removeFamilyAdmin(familyId: string, clerkId: string) {
  return db.familyAdmin.deleteMany({
    where: {
      familyId,
      clerkId,
    },
  });
}

/**
 * Update an admin role in a family
 */
export async function updateFamilyAdminRole(
  familyId: string,
  clerkId: string,
  role: string
) {
  return db.familyAdmin.update({
    where: {
      clerkId_familyId: {
        clerkId,
        familyId,
      },
    },
    data: {
      role,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get all family admin mappings for a user
 */
export async function getUserFamilyAdminMappings(clerkId: string) {
  return db.familyAdmin.findMany({
    where: { clerkId },
    include: {
      family: {
        include: {
          village: {
            select: {
              id: true,
              name: true,
            },
          },
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
}

/**
 * Whether a user has a village-wide family admin role in the given village.
 */
export async function hasVillageWideFamilyAdminRole(
  clerkId: string,
  villageId: string
): Promise<boolean> {
  const mapping = await db.familyAdmin.findFirst({
    where: {
      clerkId,
      role: ALL_FAMILIES_ADMIN_ROLE,
      family: {
        villageId,
      },
    },
    select: { id: true },
  });

  return !!mapping;
}

/**
 * Get all family ids a user can manage, including village-wide assignments.
 */
export async function getManagedFamilyIdsForUser(clerkId: string) {
  const mappings = await db.familyAdmin.findMany({
    where: { clerkId },
    include: {
      family: {
        select: {
          id: true,
          villageId: true,
        },
      },
    },
  });

  const directFamilyIds = mappings.map((item) => item.familyId).filter(Boolean);
  const villageWideVillageIds = [
    ...new Set(
      mappings
        .filter((item) => item.role === ALL_FAMILIES_ADMIN_ROLE)
        .map((item) => item.family?.villageId)
        .filter(Boolean)
    ),
  ] as string[];

  if (villageWideVillageIds.length === 0) {
    return [...new Set(directFamilyIds)];
  }

  const villageFamilies = await db.family.findMany({
    where: {
      villageId: {
        in: villageWideVillageIds,
      },
    },
    select: {
      id: true,
    },
  });

  return [
    ...new Set([...directFamilyIds, ...villageFamilies.map((family) => family.id)]),
  ];
}

/**
 * Get user's families (families they administer)
 */
export async function getUserFamilies(clerkId: string) {
  return db.familyAdmin.findMany({
    where: { clerkId },
    include: {
      family: {
        include: {
          _count: {
            select: { members: true },
          },
        },
      },
    },
  });
}

/**
 * Check if user is admin of a family
 */
export async function isUserFamilyAdmin(
  clerkId: string,
  familyId: string
): Promise<boolean> {
  if (getDevRoleOverrideByCookie() === "VIEWER") {
    return false;
  }

  const admin = await db.familyAdmin.findFirst({
    where: {
      clerkId,
      familyId,
    },
    select: { id: true },
  });

  if (admin) {
    return true;
  }

  const family = await db.family.findUnique({
    where: { id: familyId },
    select: { villageId: true },
  });

  if (!family?.villageId) {
    return false;
  }

  return hasVillageWideFamilyAdminRole(clerkId, family.villageId);
}

/**
 * Check if family exists
 */
export async function familyExists(familyId: string): Promise<boolean> {
  const family = await db.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  return !!family;
}

/**
 * Validate slug uniqueness within a village
 */
export async function isSlugUnique(
  villageId: string,
  slug: string,
  excludeFamilyId?: string
): Promise<boolean> {
  const existing = await db.family.findFirst({
    where: {
      villageId,
      slug,
      ...(excludeFamilyId && { id: { not: excludeFamilyId } }),
    },
    select: { id: true },
  });

  return !existing;
}
