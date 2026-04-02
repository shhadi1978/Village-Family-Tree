import { db } from "@/lib/db";

type GenderValue = "MALE" | "FEMALE" | "OTHER";

function isUnknownFounderFieldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("Unknown argument `isFounder`") ||
    message.includes("Unknown arg `isFounder`")
  );
}

/**
 * Create a new family member
 */
export async function createMember(
  data: {
    firstName: string;
    lastName: string;
    nickname?: string;
    gender: GenderValue;
    familyId: string;
    villageId: string;
    fatherId?: string;
    motherId?: string;
    isFounder?: boolean;
    dateOfBirth?: Date;
    dateOfDeath?: Date;
    bio?: string;
    photoUrl?: string;
  }
) {
  const isFounder = Boolean(data.isFounder);

  if (!isFounder && !data.fatherId) {
    throw new Error("fatherId is required");
  }

  if (data.motherId && data.fatherId && data.motherId === data.fatherId) {
    throw new Error("Father and mother cannot be the same member");
  }

  if (isFounder) {
    let existingFounder: { id: string } | null = null;

    try {
      existingFounder = await db.member.findFirst({
        where: {
          familyId: data.familyId,
          isFounder: true,
        },
        select: { id: true },
      });
    } catch (err) {
      if (!isUnknownFounderFieldError(err)) {
        throw err;
      }

      // Backward compatibility before applying the isFounder migration.
      existingFounder = await db.member.findFirst({
        where: {
          familyId: data.familyId,
          relationshipsAsTo: {
            none: {
              type: "PARENT",
              fromMember: {
                gender: "MALE",
              },
            },
          },
        },
        select: { id: true },
      });
    }

    if (existingFounder) {
      throw new Error("Family founder already exists");
    }

    if (data.gender !== "MALE") {
      throw new Error("Founder must be male");
    }

    if (data.fatherId || data.motherId) {
      throw new Error("Founder cannot have father or mother links");
    }

    const founderFullName = `${data.firstName} ${data.lastName}`.trim();

    const founderCreateData = {
      firstName: data.firstName,
      lastName: data.lastName,
      nickname: data.nickname?.trim() || null,
      isFounder: true,
      fullName: founderFullName,
      gender: data.gender,
      familyId: data.familyId,
      villageId: data.villageId,
      dateOfBirth: data.dateOfBirth,
      dateOfDeath: data.dateOfDeath,
      bio: data.bio,
      photoUrl: data.photoUrl,
    };

    try {
      return await db.member.create({
        data: founderCreateData,
      });
    } catch (err) {
      if (!isUnknownFounderFieldError(err)) {
        throw err;
      }

      const { isFounder: _ignored, ...legacyFounderCreateData } = founderCreateData;
      return db.member.create({
        data: legacyFounderCreateData,
      });
    }
  }

  const [father, mother] = await Promise.all([
    db.member.findUnique({
      where: { id: data.fatherId! },
      select: {
        id: true,
        gender: true,
        familyId: true,
        villageId: true,
      },
    }),
    data.motherId
      ? db.member.findUnique({
          where: { id: data.motherId },
          select: {
            id: true,
            gender: true,
            familyId: true,
            villageId: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (!father) {
    throw new Error("Father not found");
  }

  if (father.gender !== "MALE") {
    throw new Error("Selected father must be male");
  }

  if (father.villageId !== data.villageId) {
    throw new Error("Father must belong to the same village");
  }

  // Family affiliation is always by father.
  if (father.familyId !== data.familyId) {
    throw new Error("New member must belong to the father's family");
  }

  if (mother) {
    if (mother.gender !== "FEMALE") {
      throw new Error("Selected mother must be female");
    }

    if (mother.villageId !== data.villageId) {
      throw new Error("Mother must belong to the same village");
    }
  }

  const fullName = `${data.firstName} ${data.lastName}`.trim();

  return db.$transaction(async (tx: any) => {
    const member = await tx.member.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        nickname: data.nickname?.trim() || null,
        fullName,
        gender: data.gender,
        familyId: data.familyId,
        villageId: data.villageId,
        dateOfBirth: data.dateOfBirth,
        dateOfDeath: data.dateOfDeath,
        bio: data.bio,
        photoUrl: data.photoUrl,
      },
    });

    await tx.relationship.create({
      data: {
        fromMemberId: data.fatherId!,
        toMemberId: member.id,
        type: "PARENT",
        villageId: data.villageId,
      },
    });

    if (mother) {
      await tx.relationship.create({
        data: {
          fromMemberId: mother.id,
          toMemberId: member.id,
          type: "PARENT",
          villageId: data.villageId,
        },
      });
    }

    return member;
  });
}

/**
 * Get a member by ID with all relationships
 */
export async function getMemberWithRelationships(memberId: string) {
  return db.member.findUnique({
    where: { id: memberId },
    include: {
      family: true,
      village: true,
      relationshipsAsFrom: {
        include: {
          toMember: true,
        },
      },
      relationshipsAsTo: {
        include: {
          fromMember: true,
        },
      },
    },
  });
}

/**
 * Get a member by ID (basic info only)
 */
export async function getMember(memberId: string) {
  return db.member.findUnique({
    where: { id: memberId },
  });
}

/**
 * Get all members in a family
 */
export async function getFamilyMembers(familyId: string) {
  return db.member.findMany({
    where: { familyId },
    orderBy: { fullName: "asc" },
    include: {
      relationshipsAsTo: {
        where: { type: "PARENT" },
        select: {
          type: true,
          fromMember: {
            select: {
              id: true,
              firstName: true,
              fullName: true,
              gender: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Get all members in a village
 */
export async function getVillageMembers(villageId: string) {
  return db.member.findMany({
    where: { villageId },
    orderBy: { fullName: "asc" },
    include: {
      family: true,
      relationshipsAsTo: {
        where: { type: "PARENT" },
        select: {
          type: true,
          fromMember: {
            select: {
              id: true,
              firstName: true,
              fullName: true,
              gender: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Search members by name within a village
 */
export async function searchMembers(villageId: string, query: string) {
  return db.member.findMany({
    where: {
      villageId,
      OR: [
        {
          firstName: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          lastName: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          fullName: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          nickname: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    },
    orderBy: { fullName: "asc" },
    include: {
      family: true,
      relationshipsAsTo: {
        where: { type: "PARENT" },
        select: {
          type: true,
          fromMember: {
            select: {
              id: true,
              firstName: true,
              fullName: true,
              gender: true,
            },
          },
        },
      },
    },
    take: 20,
  });
}

/**
 * Get paginated members by village/family/search
 */
export async function getMembersPaginated(options: {
  familyId?: string | null;
  villageId?: string | null;
  search?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 30));
  const skip = (page - 1) * pageSize;
  const searchTerm = options.search?.trim();

  const where = {
    ...(options.familyId ? { familyId: options.familyId } : {}),
    ...(options.villageId ? { villageId: options.villageId } : {}),
    ...(searchTerm
      ? {
          OR: [
            {
              firstName: {
                contains: searchTerm,
                mode: "insensitive" as const,
              },
            },
            {
              lastName: {
                contains: searchTerm,
                mode: "insensitive" as const,
              },
            },
            {
              fullName: {
                contains: searchTerm,
                mode: "insensitive" as const,
              },
            },
            {
              nickname: {
                contains: searchTerm,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.member.findMany({
      where,
      orderBy: { fullName: "asc" },
      include: {
        ...(options.villageId ? { family: true } : {}),
        relationshipsAsTo: {
          where: { type: "PARENT" },
          select: {
            type: true,
            fromMember: {
              select: {
                id: true,
                firstName: true,
                fullName: true,
                gender: true,
              },
            },
          },
        },
      },
      skip,
      take: pageSize,
    }),
    db.member.count({ where }),
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
 * Update a member
 */
export async function updateMember(
  memberId: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    nickname: string | null;
    isFounder: boolean;
    gender: GenderValue;
    dateOfBirth: Date;
    dateOfDeath: Date;
    bio: string;
    photoUrl: string;
  }>
) {
  const existingMember = await db.member.findUnique({
    where: { id: memberId },
    select: { firstName: true, lastName: true },
  });

  if (!existingMember) {
    throw new Error("Member not found");
  }

  const nextFirstName = data.firstName ?? existingMember.firstName;
  const nextLastName = data.lastName ?? existingMember.lastName;
  const fullName = `${nextFirstName} ${nextLastName}`.trim();

  return db.member.update({
    where: { id: memberId },
    data: {
      ...data,
      nickname:
        data.nickname === undefined
          ? undefined
          : data.nickname?.trim() || null,
      fullName,
      updatedAt: new Date(),
    },
  });
}

/**
 * Delete a member and all associated relationships
 */
export async function deleteMember(memberId: string) {
  return db.member.delete({
    where: { id: memberId },
  });
}

/**
 * Get member count by gender in a family
 */
export async function getFamilyGenderStats(familyId: string) {
  const members = await db.member.groupBy({
    by: ["gender"],
    where: { familyId },
    _count: true,
  });

  return members.reduce(
    (acc: Record<string, number>, stat: { gender: string; _count: number }) => {
      acc[stat.gender] = stat._count;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Check if a member exists
 */
export async function memberExists(memberId: string): Promise<boolean> {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { id: true },
  });
  return !!member;
}
