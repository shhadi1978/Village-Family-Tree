import { db } from "@/lib/db";
import { isMarriageSchemaRuntimeError } from "@/lib/marriage-schema";

type RelationshipTypeValue = "PARENT" | "SPOUSE";

type ParentEdge = {
  fromMemberId: string;
  toMemberId: string;
};

type SpouseEdge = {
  fromMemberId: string;
  toMemberId: string;
};

function buildParentMaps(edges: ParentEdge[]) {
  const parentsByChild = new Map<string, Set<string>>();
  const childrenByParent = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!parentsByChild.has(edge.toMemberId)) {
      parentsByChild.set(edge.toMemberId, new Set<string>());
    }
    parentsByChild.get(edge.toMemberId)!.add(edge.fromMemberId);

    if (!childrenByParent.has(edge.fromMemberId)) {
      childrenByParent.set(edge.fromMemberId, new Set<string>());
    }
    childrenByParent.get(edge.fromMemberId)!.add(edge.toMemberId);
  }

  return { parentsByChild, childrenByParent };
}

function collectAncestors(
  memberId: string,
  parentsByChild: Map<string, Set<string>>
) {
  const visited = new Set<string>();
  const queue = [...(parentsByChild.get(memberId) || [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    const parents = parentsByChild.get(current);
    if (parents) {
      for (const parentId of parents) {
        if (!visited.has(parentId)) {
          queue.push(parentId);
        }
      }
    }
  }

  return visited;
}

function collectDescendants(
  memberId: string,
  childrenByParent: Map<string, Set<string>>
) {
  const visited = new Set<string>();
  const queue = [...(childrenByParent.get(memberId) || [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    const children = childrenByParent.get(current);
    if (children) {
      for (const childId of children) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }
  }

  return visited;
}

function shareAnyParent(
  memberAId: string,
  memberBId: string,
  parentsByChild: Map<string, Set<string>>
) {
  const parentsA = parentsByChild.get(memberAId) || new Set<string>();
  const parentsB = parentsByChild.get(memberBId) || new Set<string>();

  for (const parentId of parentsA) {
    if (parentsB.has(parentId)) {
      return true;
    }
  }

  return false;
}

function isAuntOrUncleOf(
  candidateId: string,
  memberId: string,
  parentsByChild: Map<string, Set<string>>,
  childrenByParent: Map<string, Set<string>>
) {
  const memberParents = parentsByChild.get(memberId) || new Set<string>();

  for (const parentId of memberParents) {
    const grandParents = parentsByChild.get(parentId) || new Set<string>();
    for (const grandParentId of grandParents) {
      const childrenOfGrandParent = childrenByParent.get(grandParentId) || new Set<string>();
      for (const siblingOfParentId of childrenOfGrandParent) {
        if (siblingOfParentId !== parentId && siblingOfParentId === candidateId) {
          return true;
        }
      }
    }
  }

  return false;
}

function buildSpouseMap(edges: SpouseEdge[]) {
  const spousesByMember = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!spousesByMember.has(edge.fromMemberId)) {
      spousesByMember.set(edge.fromMemberId, new Set<string>());
    }
    spousesByMember.get(edge.fromMemberId)!.add(edge.toMemberId);

    if (!spousesByMember.has(edge.toMemberId)) {
      spousesByMember.set(edge.toMemberId, new Set<string>());
    }
    spousesByMember.get(edge.toMemberId)!.add(edge.fromMemberId);
  }

  return spousesByMember;
}

async function validateSpouseMahramRules(data: {
  fromMemberId: string;
  toMemberId: string;
  villageId: string;
}) {
  const parentEdges = await db.relationship.findMany({
    where: {
      villageId: data.villageId,
      type: "PARENT",
    },
    select: {
      fromMemberId: true,
      toMemberId: true,
    },
  });

  const { parentsByChild, childrenByParent } = buildParentMaps(parentEdges);
  const spouseEdges = await db.relationship.findMany({
    where: {
      villageId: data.villageId,
      type: "SPOUSE",
    },
    select: {
      fromMemberId: true,
      toMemberId: true,
    },
  });
  const spousesByMember = buildSpouseMap(spouseEdges);

  const ancestorCache = new Map<string, Set<string>>();
  const descendantCache = new Map<string, Set<string>>();

  const getAncestors = (memberId: string) => {
    if (!ancestorCache.has(memberId)) {
      ancestorCache.set(memberId, collectAncestors(memberId, parentsByChild));
    }
    return ancestorCache.get(memberId)!;
  };

  const getDescendants = (memberId: string) => {
    if (!descendantCache.has(memberId)) {
      descendantCache.set(
        memberId,
        collectDescendants(memberId, childrenByParent)
      );
    }
    return descendantCache.get(memberId)!;
  };

  const fromAncestors = getAncestors(data.fromMemberId);
  const fromDescendants = getDescendants(data.fromMemberId);

  if (fromAncestors.has(data.toMemberId) || fromDescendants.has(data.toMemberId)) {
    throw new Error("Forbidden mahram relation: ascendant/descendant");
  }

  if (shareAnyParent(data.fromMemberId, data.toMemberId, parentsByChild)) {
    throw new Error("Forbidden mahram relation: siblings");
  }

  const toIsUncleOrAuntOfFrom = isAuntOrUncleOf(
    data.toMemberId,
    data.fromMemberId,
    parentsByChild,
    childrenByParent
  );

  const fromIsUncleOrAuntOfTo = isAuntOrUncleOf(
    data.fromMemberId,
    data.toMemberId,
    parentsByChild,
    childrenByParent
  );

  if (toIsUncleOrAuntOfFrom || fromIsUncleOrAuntOfTo) {
    throw new Error("Forbidden mahram relation: aunt/uncle with nephew/niece");
  }

  // Musaharah permanent prohibition: spouse of ascendant/descendant is forbidden.
  for (const ancestorId of fromAncestors) {
    if (spousesByMember.get(ancestorId)?.has(data.toMemberId)) {
      throw new Error("Forbidden in-law relation: spouse of ascendant/descendant");
    }
  }
  for (const descendantId of fromDescendants) {
    if (spousesByMember.get(descendantId)?.has(data.toMemberId)) {
      throw new Error("Forbidden in-law relation: spouse of ascendant/descendant");
    }
  }

  const toAncestors = getAncestors(data.toMemberId);
  const toDescendants = getDescendants(data.toMemberId);
  for (const ancestorId of toAncestors) {
    if (spousesByMember.get(ancestorId)?.has(data.fromMemberId)) {
      throw new Error("Forbidden in-law relation: spouse of ascendant/descendant");
    }
  }
  for (const descendantId of toDescendants) {
    if (spousesByMember.get(descendantId)?.has(data.fromMemberId)) {
      throw new Error("Forbidden in-law relation: spouse of ascendant/descendant");
    }
  }

  // Musaharah (mother-in-law / step-child):
  // any ancestor/descendant of an existing spouse is forbidden.
  const existingFromSpouses = spousesByMember.get(data.fromMemberId) || new Set<string>();
  for (const spouseId of existingFromSpouses) {
    const spouseAncestors = getAncestors(spouseId);
    const spouseDescendants = getDescendants(spouseId);
    if (spouseAncestors.has(data.toMemberId) || spouseDescendants.has(data.toMemberId)) {
      throw new Error("Forbidden in-law relation: parent/child of existing spouse");
    }

    // Temporary prohibition: cannot combine siblings, or aunt/uncle with niece/nephew.
    if (shareAnyParent(spouseId, data.toMemberId, parentsByChild)) {
      throw new Error("Forbidden temporary relation: combining siblings in marriage");
    }

    if (
      isAuntOrUncleOf(spouseId, data.toMemberId, parentsByChild, childrenByParent) ||
      isAuntOrUncleOf(data.toMemberId, spouseId, parentsByChild, childrenByParent)
    ) {
      throw new Error("Forbidden temporary relation: combining aunt/uncle with niece/nephew");
    }
  }

  const existingToSpouses = spousesByMember.get(data.toMemberId) || new Set<string>();
  for (const spouseId of existingToSpouses) {
    const spouseAncestors = getAncestors(spouseId);
    const spouseDescendants = getDescendants(spouseId);
    if (spouseAncestors.has(data.fromMemberId) || spouseDescendants.has(data.fromMemberId)) {
      throw new Error("Forbidden in-law relation: parent/child of existing spouse");
    }

    if (shareAnyParent(spouseId, data.fromMemberId, parentsByChild)) {
      throw new Error("Forbidden temporary relation: combining siblings in marriage");
    }

    if (
      isAuntOrUncleOf(spouseId, data.fromMemberId, parentsByChild, childrenByParent) ||
      isAuntOrUncleOf(data.fromMemberId, spouseId, parentsByChild, childrenByParent)
    ) {
      throw new Error("Forbidden temporary relation: combining aunt/uncle with niece/nephew");
    }
  }
}

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
      select: { id: true, villageId: true, familyId: true, gender: true },
    }),
    db.member.findUnique({
      where: { id: data.toMemberId },
      select: { id: true, villageId: true, familyId: true, gender: true },
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
    if (fromMember.gender === "OTHER" || toMember.gender === "OTHER") {
      throw new Error("Spouse relationship requires male and female members");
    }

    if (fromMember.gender === toMember.gender) {
      throw new Error("Spouse relationship requires opposite genders");
    }

    await validateSpouseMahramRules({
      fromMemberId: data.fromMemberId,
      toMemberId: data.toMemberId,
      villageId: data.villageId,
    });

    const marriage = await ensureMarriageUnit(
      data.villageId,
      data.fromMemberId,
      data.toMemberId
    );

    // Create primary direction
    const primary = await db.relationship.create({
      data: {
        fromMemberId: data.fromMemberId,
        toMemberId: data.toMemberId,
        type: data.type,
        villageId: data.villageId,
        ...(marriage ? { marriageId: marriage.id } : {}),
      },
    });

    // Create reverse direction so both families can see the link
    await db.relationship.upsert({
      where: {
        fromMemberId_toMemberId_type: {
          fromMemberId: data.toMemberId,
          toMemberId: data.fromMemberId,
          type: "SPOUSE",
        },
      },
      create: {
        fromMemberId: data.toMemberId,
        toMemberId: data.fromMemberId,
        type: "SPOUSE",
        villageId: data.villageId,
        ...(marriage ? { marriageId: marriage.id } : {}),
      },
      update: {
        villageId: data.villageId,
        ...(marriage ? { marriageId: marriage.id } : {}),
      },
    });

    return primary;
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

  const unique = new Map<string, any>();

  for (const rel of [...spousesAsFrom, ...spousesAsTo]) {
    const partnerId = rel.fromMemberId === memberId ? rel.toMemberId : rel.fromMemberId;
    const key = [memberId, partnerId].sort().join("::");
    if (!unique.has(key)) {
      unique.set(key, rel);
    }
  }

  return Array.from(unique.values());
}

/**
 * Delete a relationship
 */
export async function deleteRelationship(
  relationshipId: string
) {
  const relationship = await db.relationship.findUnique({
    where: { id: relationshipId },
  });

  if (!relationship) {
    throw new Error("Relationship not found");
  }

  if (relationship.type !== "SPOUSE") {
    return db.relationship.delete({
      where: { id: relationshipId },
    });
  }

  await db.relationship.deleteMany({
    where: {
      type: "SPOUSE",
      OR: [
        {
          fromMemberId: relationship.fromMemberId,
          toMemberId: relationship.toMemberId,
        },
        {
          fromMemberId: relationship.toMemberId,
          toMemberId: relationship.fromMemberId,
        },
      ],
    },
  });

  return relationship;
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
