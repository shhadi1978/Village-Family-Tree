import { db } from "@/lib/db";
import { isMarriageSchemaRuntimeError } from "@/lib/marriage-schema";

type RelationshipTypeValue = "PARENT" | "SPOUSE";

function getCanonicalMarriagePartners(memberAId: string, memberBId: string) {
  return memberAId < memberBId
    ? { partnerAId: memberAId, partnerBId: memberBId }
    : { partnerAId: memberBId, partnerBId: memberAId };
}

export async function ensureMarriageUnit(
  villageId: string,
  memberAId: string,
  memberBId: string,
  tx: any = db
) {
  if (memberAId === memberBId) {
    throw new Error("Marriage partners cannot be the same member");
  }

  const { partnerAId, partnerBId } = getCanonicalMarriagePartners(
    memberAId,
    memberBId
  );

  try {
    const existing = await tx.marriage.findUnique({
      where: {
        partnerAId_partnerBId: {
          partnerAId,
          partnerBId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return tx.marriage.create({
      data: {
        villageId,
        partnerAId,
        partnerBId,
      },
    });
  } catch (error) {
    if (isMarriageSchemaRuntimeError(error)) {
      return null;
    }

    throw error;
  }
}

async function inferMarriageIdForParentRelationship(
  parentId: string,
  childId: string,
  villageId: string,
  tx: any = db
) {
  const existingParents = await tx.relationship.findMany({
    where: {
      toMemberId: childId,
      type: "PARENT",
      fromMemberId: { not: parentId },
    },
    include: {
      fromMember: {
        select: {
          id: true,
          gender: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const parent = await tx.member.findUnique({
    where: { id: parentId },
    select: { gender: true },
  });

  if (!parent || parent.gender === "OTHER") {
    return null;
  }

  const counterpart = existingParents.find(
    (relationship: any) => relationship.fromMember?.gender !== parent.gender
  );

  if (!counterpart?.fromMemberId) {
    return null;
  }

  const marriage = await ensureMarriageUnit(
    villageId,
    parentId,
    counterpart.fromMemberId,
    tx
  );

  if (!marriage) {
    return null;
  }

  return marriage.id;
}

async function syncSiblingParentMarriageLinks(
  childId: string,
  marriageId: string | null,
  tx: any = db
) {
  if (!marriageId) {
    return;
  }

  await tx.relationship.updateMany({
    where: {
      toMemberId: childId,
      type: "PARENT",
    },
    data: {
      marriageId,
    },
  });
}

/**
 * Create a relationship between two members
 * Validates that both members exist and are in the same village
 */
export async function createRelationship(
  data: {
    fromMemberId: string;
    toMemberId: string;
    type: RelationshipTypeValue;
    villageId: string;
    replaceExistingParent?: boolean;
    marriageId?: string | null;
  }
) {
  if (data.type === "SPOUSE") {
    const existingSpouseRelationship = await db.relationship.findFirst({
      where: {
        type: "SPOUSE",
        OR: [
          {
            fromMemberId: data.fromMemberId,
            toMemberId: data.toMemberId,
          },
          {
            fromMemberId: data.toMemberId,
            toMemberId: data.fromMemberId,
          },
        ],
      },
      select: { id: true },
    });

    if (existingSpouseRelationship) {
      throw new Error("Relationship already exists for the selected member IDs");
    }
  }

  const existingExactRelationship = await db.relationship.findFirst({
    where: {
      fromMemberId: data.fromMemberId,
      toMemberId: data.toMemberId,
      type: data.type,
    },
    select: { id: true },
  });

  if (existingExactRelationship) {
    throw new Error("Relationship already exists for the selected member IDs");
  }

  // Validate both members exist
  const [fromMember, toMember] = await Promise.all([
    db.member.findUnique({
      where: { id: data.fromMemberId },
      select: { id: true, villageId: true, familyId: true },
    }),
    db.member.findUnique({
      where: { id: data.toMemberId },
      select: { id: true, villageId: true, familyId: true },
    }),
  ]);

  if (!fromMember) {
    throw new Error(`Member ${data.fromMemberId} not found`);
  }

  if (!toMember) {
    throw new Error(`Member ${data.toMemberId} not found`);
  }

  // Verify both members are in the same village
  if (
    fromMember.villageId !== data.villageId ||
    toMember.villageId !== data.villageId
  ) {
    throw new Error("Both members must be in the same village");
  }

  if (data.type === "SPOUSE") {
    const marriage = await ensureMarriageUnit(
      data.villageId,
      data.fromMemberId,
      data.toMemberId
    );

    return db.relationship.create({
      data: {
        fromMemberId: data.fromMemberId,
        toMemberId: data.toMemberId,
        type: data.type,
        villageId: data.villageId,
        ...(marriage ? { marriageId: marriage.id } : {}),
      },
    });
  }

  // For PARENT relationships: validate one parent direction to avoid ambiguity
  if (data.type === "PARENT") {
    const parent = await db.member.findUnique({
      where: { id: data.fromMemberId },
      select: { id: true, gender: true, familyId: true },
    });

    const child = await db.member.findUnique({
      where: { id: data.toMemberId },
      select: { id: true, familyId: true },
    });

    if (!parent || !child) {
      throw new Error("Parent or child member not found");
    }

    if (parent.gender === "OTHER") {
      throw new Error("Parent must be male or female");
    }

    // Lineage/affiliation is always by father, so father must be in same family as child.
    if (parent.gender === "MALE" && parent.familyId !== child.familyId) {
      throw new Error(
        "Father must belong to the same family as the child"
      );
    }

    // Allow only one father and one mother per child.
    const existingParents = await db.relationship.findMany({
      where: {
        toMemberId: data.toMemberId,
        type: "PARENT",
      },
      include: {
        fromMember: {
          select: {
            id: true,
            gender: true,
          },
        },
      },
    });

    const hasDifferentFather = existingParents.some(
      (rel: { fromMember: { gender: string }; fromMemberId: string }) =>
        rel.fromMember.gender === "MALE" && rel.fromMemberId !== data.fromMemberId
    );
    if (parent.gender === "MALE" && hasDifferentFather && !data.replaceExistingParent) {
      throw new Error("Each member can have only one father");
    }

    const hasDifferentMother = existingParents.some(
      (rel: { fromMember: { gender: string }; fromMemberId: string }) =>
        rel.fromMember.gender === "FEMALE" && rel.fromMemberId !== data.fromMemberId
    );
    if (parent.gender === "FEMALE" && hasDifferentMother && !data.replaceExistingParent) {
      throw new Error("Each member can have only one mother");
    }

    // Check if inverse relationship already exists
    const inverseExists = await db.relationship.findFirst({
      where: {
        fromMemberId: data.toMemberId,
        toMemberId: data.fromMemberId,
        type: "PARENT",
      },
    });

    if (inverseExists) {
      throw new Error(
        "Circular parent relationship detected: Cannot create PARENT relationship in opposite direction"
      );
    }
  }

  if (data.type === "PARENT" && data.replaceExistingParent) {
    const parentGender = await db.member.findUnique({
      where: { id: data.fromMemberId },
      select: { gender: true },
    });

    if (!parentGender || parentGender.gender === "OTHER") {
      throw new Error("Parent must be male or female");
    }

    return db.$transaction(async (tx) => {
      const marriageId =
        data.marriageId ||
        (await inferMarriageIdForParentRelationship(
          data.fromMemberId,
          data.toMemberId,
          data.villageId,
          tx
        ));

      await tx.relationship.deleteMany({
        where: {
          toMemberId: data.toMemberId,
          type: "PARENT",
          fromMemberId: { not: data.fromMemberId },
          fromMember: { gender: parentGender.gender },
        },
      });

      const created = await tx.relationship.create({
        data: {
          fromMemberId: data.fromMemberId,
          toMemberId: data.toMemberId,
          type: data.type,
          villageId: data.villageId,
          ...(marriageId ? { marriageId } : {}),
        },
      });

      await syncSiblingParentMarriageLinks(data.toMemberId, marriageId, tx);
      return created;
    });
  }

  const marriageId =
    data.marriageId ||
    (await inferMarriageIdForParentRelationship(
      data.fromMemberId,
      data.toMemberId,
      data.villageId
    ));

  return db.$transaction(async (tx) => {
    const created = await tx.relationship.create({
      data: {
        fromMemberId: data.fromMemberId,
        toMemberId: data.toMemberId,
        type: data.type,
        villageId: data.villageId,
        ...(marriageId ? { marriageId } : {}),
      },
    });

    await syncSiblingParentMarriageLinks(data.toMemberId, marriageId, tx);
    return created;
  });
}

/**
 * Get relationship by ID
 */
export async function getRelationship(
  relationshipId: string
) {
  return db.relationship.findUnique({
    where: { id: relationshipId },
  });
}

/**
 * Get relationship with both members' details
 */
export async function getRelationshipWithMembers(
  relationshipId: string
) {
  return db.relationship.findUnique({
    where: { id: relationshipId },
    include: {
      fromMember: true,
      toMember: true,
    },
  });
}

/**
 * Get all relationships for a member (both directions)
 */
export async function getMemberRelationships(
  memberId: string
) {
  const [relationshipsFrom, relationshipsTo] = await Promise.all([
    db.relationship.findMany({
      where: { fromMemberId: memberId },
      include: {
        toMember: true,
      },
    }),
    db.relationship.findMany({
      where: { toMemberId: memberId },
      include: {
        fromMember: true,
      },
    }),
  ]);

  return {
    from: relationshipsFrom,
    to: relationshipsTo,
  };
}

/**
 * Get parent-child relationships for a member
 */
export async function getParentRelationships(memberId: string) {
  return db.relationship.findMany({
    where: {
      toMemberId: memberId,
      type: "PARENT",
    },
    include: {
      fromMember: true,
    },
  });
}

/**
 * Get all children for a member
 */
export async function getChildRelationships(memberId: string) {
  return db.relationship.findMany({
    where: {
      fromMemberId: memberId,
      type: "PARENT",
    },
    include: {
      toMember: true,
    },
  });
}

/**
 * Get all spouses for a member
 */
export async function getSpouseRelationships(memberId: string) {
  const [spousesAsFrom, spousesAsTo] = await Promise.all([
    db.relationship.findMany({
      where: {
        fromMemberId: memberId,
        type: "SPOUSE",
      },
      include: {
        toMember: true,
      },
    }),
    db.relationship.findMany({
      where: {
        toMemberId: memberId,
        type: "SPOUSE",
      },
      include: {
        fromMember: true,
      },
    }),
  ]);

  return [...spousesAsFrom, ...spousesAsTo];
}

/**
 * Delete a relationship
 */
export async function deleteRelationship(
  relationshipId: string
) {
  return db.relationship.delete({
    where: { id: relationshipId },
  });
}

/**
 * Check if a relationship exists
 */
export async function relationshipExists(
  fromMemberId: string,
  toMemberId: string,
  type: RelationshipTypeValue
): Promise<boolean> {
  const relationship = await db.relationship.findFirst({
    where: {
      fromMemberId,
      toMemberId,
      type,
    },
    select: { id: true },
  });

  return !!relationship;
}

/**
 * Get relationship stats for a village
 */
export async function getVillageRelationshipStats(villageId: string) {
  const stats = await db.relationship.groupBy({
    by: ["type"],
    where: { villageId },
    _count: true,
  });

  return stats.reduce(
    (acc: Record<string, number>, stat: { type: string; _count: number }) => {
      acc[stat.type] = stat._count;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Get all siblings for a member
 */
export async function getSiblings(memberId: string) {
  // Get all parents of this member
  const parents = await getParentRelationships(memberId);
  const parentIds = parents.map((rel: { fromMemberId: string }) => rel.fromMemberId);

  if (parentIds.length === 0) return [];

  // Get all children of those parents (excluding the member itself)
  const siblings = await db.relationship.findMany({
    where: {
      fromMemberId: {
        in: parentIds,
      },
      toMemberId: {
        not: memberId,
      },
      type: "PARENT",
    },
    include: {
      toMember: true,
    },
  });

  return siblings;
}
