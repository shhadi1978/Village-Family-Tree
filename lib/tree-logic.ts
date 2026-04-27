import { db } from "./db";
import { isMarriageSchemaRuntimeError } from "./marriage-schema";

type GenderValue = "MALE" | "FEMALE" | "OTHER";
type RelationshipTypeValue = "PARENT" | "SPOUSE";

export interface MemberRecord {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  isFounder: boolean;
  fullName: string;
  gender: GenderValue;
  isExternal?: boolean;
  externalOriginText?: string | null;
  externalNotes?: string | null;
  dateOfBirth?: Date | null;
  dateOfDeath?: Date | null;
  bio?: string | null;
  photoUrl?: string | null;
  familyId: string;
  villageId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RelationshipRecord {
  id: string;
  type: RelationshipTypeValue;
  fromMemberId: string;
  toMemberId: string;
  villageId: string;
  marriage?: { id: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

function isMissingExternalFieldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();

  return (
    (message.includes("isExternal") ||
      message.includes("externalOriginText") ||
      message.includes("externalNotes")) &&
    (lower.includes("does not exist") ||
      message.includes("P2022") ||
      lower.includes("unknown argument") ||
      lower.includes("unknown field"))
  );
}

export interface FamilyTreeMarriageGroup {
  marriageId: string;
  spouse: FamilyTreeNode | null;
  children: FamilyTreeNode[];
}

/**
 * Extended Member type with relationship data
 */
export interface MemberWithRelationships extends MemberRecord {
  relationshipsAsFrom: (RelationshipRecord & {
    toMember: MemberRecord;
  })[];
  relationshipsAsTo: (RelationshipRecord & {
    fromMember: MemberRecord;
  })[];
}

/**
 * Tree node representation for visualization
 */
export interface FamilyTreeNode {
  member: MemberWithRelationships;
  parents: FamilyTreeNode[];
  siblings: FamilyTreeNode[];
  children: FamilyTreeNode[];
  spouses: FamilyTreeNode[];
  marriages: FamilyTreeMarriageGroup[];
}

function toShallowTreeNode(member: MemberWithRelationships): FamilyTreeNode {
  return {
    member,
    parents: [],
    siblings: [],
    children: [],
    spouses: [],
    marriages: [],
  };
}

function getUniqueSpouseIds(member: MemberWithRelationships): string[] {
  const spouseRelationshipsAsFrom = member.relationshipsAsFrom.filter(
    (rel) => rel.type === "SPOUSE"
  );

  const spouseRelationshipsAsTo = member.relationshipsAsTo.filter(
    (rel) => rel.type === "SPOUSE"
  );

  const spouseCombined = [
    ...spouseRelationshipsAsFrom,
    ...spouseRelationshipsAsTo,
  ];

  const uniqueSpouses = new Set<string>();
  spouseCombined.forEach((rel) => {
    const spouseId = rel.fromMemberId === member.id ? rel.toMemberId : rel.fromMemberId;
    uniqueSpouses.add(spouseId);
  });

  return Array.from(uniqueSpouses);
}

function getSyntheticMarriageGroupId(memberAId: string, memberBId: string) {
  return [memberAId, memberBId].sort().join("__legacy_marriage__");
}

function safeDateTime(value?: Date | string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function compareMembersForDescOrder(a: MemberRecord, b: MemberRecord) {
  const birthA = safeDateTime(a.dateOfBirth);
  const birthB = safeDateTime(b.dateOfBirth);
  if (birthA !== birthB) {
    return birthA - birthB;
  }

  const createdA = safeDateTime(a.createdAt);
  const createdB = safeDateTime(b.createdAt);
  if (createdA !== createdB) {
    return createdA - createdB;
  }

  const firstNameCmp = String(a.firstName || "").localeCompare(String(b.firstName || ""), "ar");
  if (firstNameCmp !== 0) {
    return firstNameCmp;
  }

  return String(a.fullName || "").localeCompare(String(b.fullName || ""), "ar");
}

function compareTreeNodesForDescOrder(a: FamilyTreeNode, b: FamilyTreeNode) {
  return compareMembersForDescOrder(a.member, b.member);
}

async function fetchShallowSpouseNodes(
  member: MemberWithRelationships,
  visitedIds?: Set<string>
): Promise<FamilyTreeNode[]> {
  const spouseIds = getUniqueSpouseIds(member).filter(
    (spouseId) => !visitedIds?.has(spouseId)
  );

  const spouseMembers = await Promise.all(
    spouseIds.map((spouseId) => fetchMemberWithRelationships(spouseId))
  );

  const spouses: FamilyTreeNode[] = [];
  spouseMembers.forEach((spouseMember, index) => {
    if (!spouseMember) {
      return;
    }

    visitedIds?.add(spouseIds[index]);
    spouses.push(toShallowTreeNode(spouseMember));
  });

  return spouses.sort(compareTreeNodesForDescOrder);
}

async function buildMarriageGroups(
  member: MemberWithRelationships,
  childRelationships: Array<RelationshipRecord & { toMember: MemberRecord }>,
  childNodes: Array<FamilyTreeNode | null>,
  visitedIds: Set<string>,
  mode: TreeViewMode
): Promise<FamilyTreeMarriageGroup[]> {
  const spouseRelationships = [
    ...member.relationshipsAsFrom.filter((rel) => rel.type === "SPOUSE"),
    ...member.relationshipsAsTo.filter((rel) => rel.type === "SPOUSE"),
  ];

  const spouseNodesByMarriageId = new Map<string, FamilyTreeNode | null>();
  const spouseIdByPairKey = new Map<string, string>();
  const marriageIdByPairKey = new Map<string, string>();

  spouseRelationships.forEach((relationship) => {
    const spouseId =
      relationship.fromMemberId === member.id
        ? relationship.toMemberId
        : relationship.fromMemberId;

    const pairKey = getSyntheticMarriageGroupId(member.id, spouseId);
    spouseIdByPairKey.set(pairKey, spouseId);

    if (relationship.marriage?.id) {
      marriageIdByPairKey.set(pairKey, relationship.marriage.id);
    } else if (!marriageIdByPairKey.has(pairKey)) {
      marriageIdByPairKey.set(pairKey, pairKey);
    }
  });

  await Promise.all(
    Array.from(spouseIdByPairKey.entries()).map(async ([pairKey, spouseId]) => {
      const marriageId = marriageIdByPairKey.get(pairKey) || pairKey;

      if (spouseNodesByMarriageId.has(marriageId)) {
        return;
      }

      // Always fetch spouse — even if already in visitedIds (e.g. they were
      // traversed as a parent of a shared child). A shallow spouse node is
      // safe to create regardless because it has no further recursion.
      const spouseMember = await fetchMemberWithRelationships(spouseId);
      if (!spouseMember) {
        spouseNodesByMarriageId.set(marriageId, null);
        return;
      }

      if (mode === "FULL") {
        visitedIds.add(spouseId);
      }

      spouseNodesByMarriageId.set(marriageId, toShallowTreeNode(spouseMember));
    })
  );

  const spouseIdSet = new Set(Array.from(spouseIdByPairKey.values()));

  const childrenByMarriageId = new Map<string, FamilyTreeNode[]>();
  childRelationships.forEach((relationship, index) => {
    const childNode = childNodes[index];
    let marriageId = relationship.marriage?.id || null;

    if (!marriageId && childNode) {
      const counterpartParent = childNode.member.relationshipsAsTo.find(
        (parentRelationship) =>
          parentRelationship.type === "PARENT" &&
          parentRelationship.fromMemberId !== member.id &&
          spouseIdSet.has(parentRelationship.fromMemberId)
      );

      if (counterpartParent?.fromMemberId) {
        const pairKey = getSyntheticMarriageGroupId(
          member.id,
          counterpartParent.fromMemberId
        );
        marriageId = marriageIdByPairKey.get(pairKey) || pairKey;
      }
    }

    if (!childNode) {
      return;
    }

    if (marriageId) {
      const existing = childrenByMarriageId.get(marriageId) || [];
      existing.push(childNode);
      childrenByMarriageId.set(marriageId, existing);
    }
  });

  const marriageIds = Array.from(
    new Set([
      ...Array.from(spouseNodesByMarriageId.keys()),
      ...Array.from(childrenByMarriageId.keys()),
    ])
  );

  const groups = marriageIds.map((marriageId) => ({
    marriageId,
    spouse: spouseNodesByMarriageId.get(marriageId) || null,
    children: (childrenByMarriageId.get(marriageId) || []).sort(compareTreeNodesForDescOrder),
  }));

  groups.sort((a, b) => {
    if (a.spouse && b.spouse) {
      return compareTreeNodesForDescOrder(a.spouse, b.spouse);
    }

    if (a.spouse && !b.spouse) {
      return -1;
    }

    if (!a.spouse && b.spouse) {
      return 1;
    }

    const aFirstChild = a.children[0];
    const bFirstChild = b.children[0];
    if (aFirstChild && bFirstChild) {
      return compareTreeNodesForDescOrder(aFirstChild, bFirstChild);
    }

    return a.marriageId.localeCompare(b.marriageId);
  });

  return groups;
}

type TreeViewMode = "FULL" | "DESCENDANTS";

export type FocusedTreeOptions = {
  includeParents?: boolean;
  includeSiblings?: boolean;
  includeDescendants?: boolean;
};

/**
 * Fetch a single member with all their relationships
 */
async function fetchMemberWithRelationships(
  memberId: string
): Promise<MemberWithRelationships | null> {
  const buildMemberBaseSelect = (includeExternalFields: boolean) => ({
    id: true,
    firstName: true,
    lastName: true,
    nickname: true,
    isFounder: true,
    fullName: true,
    gender: true,
    ...(includeExternalFields
      ? {
          isExternal: true,
          externalOriginText: true,
          externalNotes: true,
        }
      : {}),
    dateOfBirth: true,
    dateOfDeath: true,
    bio: true,
    photoUrl: true,
    familyId: true,
    villageId: true,
    createdAt: true,
    updatedAt: true,
  });

  const withExternalDefaults = (member: any): MemberWithRelationships => ({
    ...member,
    isExternal: Boolean(member?.isExternal),
    externalOriginText: member?.externalOriginText ?? null,
    externalNotes: member?.externalNotes ?? null,
    relationshipsAsFrom: (member?.relationshipsAsFrom || []).map((rel: any) => ({
      ...rel,
      toMember: {
        ...rel.toMember,
        isExternal: Boolean(rel.toMember?.isExternal),
        externalOriginText: rel.toMember?.externalOriginText ?? null,
        externalNotes: rel.toMember?.externalNotes ?? null,
      },
    })),
    relationshipsAsTo: (member?.relationshipsAsTo || []).map((rel: any) => ({
      ...rel,
      fromMember: {
        ...rel.fromMember,
        isExternal: Boolean(rel.fromMember?.isExternal),
        externalOriginText: rel.fromMember?.externalOriginText ?? null,
        externalNotes: rel.fromMember?.externalNotes ?? null,
      },
    })),
  });

  const queryMember = async (options: {
    includeExternalFields: boolean;
    includeMarriage: boolean;
  }) => {
    const baseSelect = buildMemberBaseSelect(options.includeExternalFields);

    return (db.member as any).findUnique({
      where: { id: memberId },
      select: {
        ...baseSelect,
        relationshipsAsFrom: {
          select: {
            id: true,
            type: true,
            fromMemberId: true,
            toMemberId: true,
            villageId: true,
            createdAt: true,
            updatedAt: true,
            ...(options.includeMarriage
              ? {
                  marriage: {
                    select: {
                      id: true,
                    },
                  },
                }
              : {}),
            toMember: {
              select: baseSelect,
            },
          },
        },
        relationshipsAsTo: {
          select: {
            id: true,
            type: true,
            fromMemberId: true,
            toMemberId: true,
            villageId: true,
            createdAt: true,
            updatedAt: true,
            ...(options.includeMarriage
              ? {
                  marriage: {
                    select: {
                      id: true,
                    },
                  },
                }
              : {}),
            fromMember: {
              select: baseSelect,
            },
          },
        },
      },
    });
  };

  try {
    const member = await queryMember({
      includeExternalFields: true,
      includeMarriage: true,
    });
    return member as MemberWithRelationships | null;
  } catch (error) {
    if (isMissingExternalFieldError(error)) {
      const memberWithoutExternal = await queryMember({
        includeExternalFields: false,
        includeMarriage: true,
      });
      return memberWithoutExternal
        ? withExternalDefaults(memberWithoutExternal)
        : null;
    }

    if (!isMarriageSchemaRuntimeError(error)) {
      throw error;
    }

    try {
      const legacyMember = await queryMember({
        includeExternalFields: true,
        includeMarriage: false,
      });
      return legacyMember as MemberWithRelationships | null;
    } catch (legacyError) {
      if (!isMissingExternalFieldError(legacyError)) {
        throw legacyError;
      }

      const legacyMemberWithoutExternal = await queryMember({
        includeExternalFields: false,
        includeMarriage: false,
      });

      return legacyMemberWithoutExternal
        ? withExternalDefaults(legacyMemberWithoutExternal)
        : null;
    }
  }
}

/**
 * Recursively fetch family tree up to specified depth
 * Prevents infinite loops by tracking visited members
 *
 * @param memberId - The root member ID to start the tree from
 * @param maxDepth - Maximum tree depth (default: 5)
 * @param visitedIds - Set of already visited member IDs (for cycle prevention)
 * @param currentDepth - Current recursion depth (internal tracking)
 * @returns FamilyTreeNode or null if member not found
 */
export async function fetchFamilyTree(
  memberId: string,
  maxDepth: number = 5,
  visitedIds: Set<string> = new Set(),
  currentDepth: number = 0,
  mode: TreeViewMode = "FULL"
): Promise<FamilyTreeNode | null> {
  // Base case: max depth reached or member already visited (cycle prevention)
  if (currentDepth >= maxDepth || visitedIds.has(memberId)) {
    return null;
  }

  // Mark this member as visited
  visitedIds.add(memberId);

  try {
    // Fetch the member with all their relationships
    const member = await fetchMemberWithRelationships(memberId);

    if (!member) {
      visitedIds.delete(memberId); // Unmark if not found
      return null;
    }

    // Separate relationships by type
    const parentRelationships = member.relationshipsAsTo
      .filter((rel) => rel.type === "PARENT")
      .sort((a, b) => compareMembersForDescOrder(a.fromMember, b.fromMember));

    const childRelationships = member.relationshipsAsFrom
      .filter((rel) => rel.type === "PARENT")
      .sort((a, b) => compareMembersForDescOrder(a.toMember, b.toMember));

    const parents: FamilyTreeNode[] =
      mode === "FULL"
        ? (
            await Promise.all(
              parentRelationships.map((rel) =>
                fetchFamilyTree(
                  rel.fromMemberId,
                  maxDepth,
                  visitedIds,
                  currentDepth + 1,
                  mode
                )
              )
            )
          ).filter((node): node is FamilyTreeNode => !!node)
        : [];

    // Recursively fetch children (depth + 1)
    const childNodes = await Promise.all(
      childRelationships.map((rel) =>
        fetchFamilyTree(rel.toMemberId, maxDepth, visitedIds, currentDepth + 1, mode)
      )
    );
    const allChildNodes: FamilyTreeNode[] = childNodes
      .filter((node): node is FamilyTreeNode => !!node)
      .sort(compareTreeNodesForDescOrder);

    const marriages = await buildMarriageGroups(
      member,
      childRelationships,
      childNodes,
      visitedIds,
      mode
    );
    const groupedChildIds = new Set(
      marriages.flatMap((marriage) => marriage.children.map((child) => child.member.id))
    );
    const children = allChildNodes
      .filter((child) => !groupedChildIds.has(child.member.id))
      .sort(compareTreeNodesForDescOrder);

    const spouses = marriages
      .map((marriage) => marriage.spouse)
      .filter((spouse): spouse is FamilyTreeNode => !!spouse)
      .sort(compareTreeNodesForDescOrder);

    const sortedParents = parents.sort(compareTreeNodesForDescOrder);

    return {
      member,
      parents: sortedParents,
      siblings: [],
      children,
      spouses,
      marriages,
    };
  } catch (error) {
    console.error(`Error fetching family tree for member ${memberId}:`, error);
    visitedIds.delete(memberId);
    return null;
  }
}

export default fetchFamilyTree;

async function fetchSiblingNodes(
  member: MemberWithRelationships
): Promise<FamilyTreeNode[]> {
  const parentIds = member.relationshipsAsTo
    .filter((rel) => rel.type === "PARENT")
    .map((rel) => rel.fromMemberId);

  if (parentIds.length === 0) {
    return [];
  }

  const siblingRelations = await db.relationship.findMany({
    where: {
      type: "PARENT",
      fromMemberId: { in: parentIds },
      toMemberId: { not: member.id },
    },
    select: {
      toMemberId: true,
    },
  });

  const siblingIds = Array.from(
    new Set(siblingRelations.map((relation: { toMemberId: string }) => relation.toMemberId))
  ) as string[];

  if (siblingIds.length === 0) {
    return [];
  }

  const siblingMembers = await Promise.all(
    siblingIds.map((siblingId) => fetchMemberWithRelationships(siblingId))
  );

  return siblingMembers
    .filter((sibling): sibling is MemberWithRelationships => !!sibling)
    .map((sibling) => ({
      member: sibling,
      parents: [],
      siblings: [],
      children: [],
      spouses: [],
      marriages: [],
    }));
}

export async function fetchFocusedFamilyTree(
  memberId: string,
  maxDepth: number = 5,
  options: FocusedTreeOptions = {}
): Promise<FamilyTreeNode | null> {
  const member = await fetchMemberWithRelationships(memberId);

  if (!member) {
    return null;
  }

  const includeParents = options.includeParents !== false;
  const includeSiblings = options.includeSiblings !== false;
  const includeDescendants = options.includeDescendants !== false;

  const parents = includeParents
    ? member.relationshipsAsTo
        .filter((rel) => rel.type === "PARENT")
        .map((rel) => rel.fromMember)
        .filter((parent): parent is MemberWithRelationships => !!parent)
        .map((parent) => toShallowTreeNode(parent))
    : [];

  const siblings = includeSiblings ? await fetchSiblingNodes(member) : [];
  const descendantsTree = includeDescendants
    ? await fetchFamilyTree(memberId, maxDepth, new Set(), 0, "DESCENDANTS")
    : null;
  const spouses = descendantsTree?.spouses || (await fetchShallowSpouseNodes(member));

  return {
    member,
    parents,
    siblings,
    children: descendantsTree?.children || [],
    spouses,
    marriages: descendantsTree?.marriages || [],
  };
}

/**
 * Flatten the family tree into a list of all members
 * Useful for getting all unique members in the tree
 */
export function flattenFamilyTree(node: FamilyTreeNode | null): MemberRecord[] {
  if (!node) return [];

  const members = new Map<string, MemberRecord>();
  const queue: FamilyTreeNode[] = [node];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (!members.has(current.member.id)) {
      members.set(current.member.id, current.member);
    }

    queue.push(...current.parents);
    queue.push(...current.children);
    queue.push(...current.spouses);
    queue.push(...current.marriages.flatMap((marriage) => marriage.children));
    queue.push(
      ...current.marriages
        .map((marriage) => marriage.spouse)
        .filter((spouse): spouse is FamilyTreeNode => !!spouse)
    );
  }

  return Array.from(members.values());
}

/**
 * Get all descendants of a member up to specified depth
 * Useful for subtree queries
 */
export async function getDescendants(
  memberId: string,
  maxDepth: number = 5
): Promise<MemberRecord[]> {
  const descendants = new Set<string>();
  const queue: { memberId: string; depth: number }[] = [
    { memberId, depth: 0 },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { memberId: currentId, depth } = queue.shift()!;

    if (depth >= maxDepth || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    // Get all children of the current member
    const relationships = await db.relationship.findMany({
      where: {
        fromMemberId: currentId,
        type: "PARENT",
      },
      include: {
        toMember: true,
      },
    });

    for (const rel of relationships) {
      descendants.add(rel.toMemberId);
      queue.push({ memberId: rel.toMemberId, depth: depth + 1 });
    }
  }

  // Fetch all descendant members
  if (descendants.size === 0) return [];

  return db.member.findMany({
    where: {
      id: {
        in: Array.from(descendants),
      },
    },
  });
}

/**
 * Get all ancestors of a member up to specified depth
 * Useful for lineage queries
 */
export async function getAncestors(
  memberId: string,
  maxDepth: number = 5
): Promise<MemberRecord[]> {
  const ancestors = new Set<string>();
  const queue: { memberId: string; depth: number }[] = [
    { memberId, depth: 0 },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { memberId: currentId, depth } = queue.shift()!;

    if (depth >= maxDepth || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    // Get all parents of the current member
    const relationships = await db.relationship.findMany({
      where: {
        toMemberId: currentId,
        type: "PARENT",
      },
      include: {
        fromMember: true,
      },
    });

    for (const rel of relationships) {
      ancestors.add(rel.fromMemberId);
      queue.push({ memberId: rel.fromMemberId, depth: depth + 1 });
    }
  }

  // Fetch all ancestor members
  if (ancestors.size === 0) return [];

  return db.member.findMany({
    where: {
      id: {
        in: Array.from(ancestors),
      },
    },
  });
}

/**
 * Check if two members are related (within the same family tree)
 * Returns true if a path exists between them
 */
export async function areRelated(
  memberId1: string,
  memberId2: string
): Promise<boolean> {
  const ancestors = new Set<string>();
  const queue: string[] = [memberId1];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    if (currentId === memberId2) {
      return true;
    }

    // Get all related members (parents, children, spouses)
    const relationships = await db.relationship.findMany({
      where: {
        OR: [
          { fromMemberId: currentId },
          { toMemberId: currentId },
        ],
      },
    });

    for (const rel of relationships) {
      const relatedId =
        rel.fromMemberId === currentId ? rel.toMemberId : rel.fromMemberId;
      if (!visited.has(relatedId)) {
        queue.push(relatedId);
      }
    }
  }

  return false;
}
