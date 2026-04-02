import { db } from "./db";

type GenderValue = "MALE" | "FEMALE" | "OTHER";
type RelationshipTypeValue = "PARENT" | "SPOUSE";

export interface MemberRecord {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  fullName: string;
  gender: GenderValue;
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
  createdAt: Date;
  updatedAt: Date;
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
  return db.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
      fullName: true,
      gender: true,
      dateOfBirth: true,
      dateOfDeath: true,
      bio: true,
      photoUrl: true,
      familyId: true,
      villageId: true,
      createdAt: true,
      updatedAt: true,
      relationshipsAsFrom: {
        select: {
          id: true,
          type: true,
          fromMemberId: true,
          toMemberId: true,
          villageId: true,
          createdAt: true,
          updatedAt: true,
          toMember: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              nickname: true,
              fullName: true,
              gender: true,
              dateOfBirth: true,
              dateOfDeath: true,
              bio: true,
              photoUrl: true,
              familyId: true,
              villageId: true,
              createdAt: true,
              updatedAt: true,
            },
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
          fromMember: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              nickname: true,
              fullName: true,
              gender: true,
              dateOfBirth: true,
              dateOfDeath: true,
              bio: true,
              photoUrl: true,
              familyId: true,
              villageId: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });
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
    const parentRelationships = member.relationshipsAsTo.filter(
      (rel) => rel.type === "PARENT"
    );

    const childRelationships = member.relationshipsAsFrom.filter(
      (rel) => rel.type === "PARENT"
    );

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

    // Create a set to track unique spouses (avoid duplicates)
    const uniqueSpouses = new Map<
      string,
      RelationshipRecord & { toMember?: MemberRecord; fromMember?: MemberRecord }
    >();

    spouseCombined.forEach((rel) => {
      const spouseId = rel.fromMemberId === memberId ? rel.toMemberId : rel.fromMemberId;
      if (!uniqueSpouses.has(spouseId)) {
        uniqueSpouses.set(spouseId, rel);
      }
    });

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
    const children: FamilyTreeNode[] = childNodes.filter(
      (node): node is FamilyTreeNode => !!node
    );

    // Recursively fetch spouses (depth + 1)
    const spouseIds = (mode === "FULL" ? Array.from(uniqueSpouses.keys()) : []).filter(
      (spouseId) => !visitedIds.has(spouseId)
    );
    const spouseMembers = await Promise.all(
      spouseIds.map((spouseId) => fetchMemberWithRelationships(spouseId))
    );
    const spouses: FamilyTreeNode[] = [];
    spouseMembers.forEach((spouseMember, index) => {
      if (!spouseMember) {
        return;
      }
      visitedIds.add(spouseIds[index]);
      spouses.push({
        member: spouseMember,
        parents: [],
        siblings: [],
        children: [],
        spouses: [],
      });
    });

    return {
      member,
      parents,
      siblings: [],
      children,
      spouses,
    };
  } catch (error) {
    console.error(`Error fetching family tree for member ${memberId}:`, error);
    visitedIds.delete(memberId);
    return null;
  }
}

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
        .map((parent) => ({
          member: parent,
          parents: [],
          siblings: [],
          children: [],
          spouses: [],
        }))
    : [];

  const siblings = includeSiblings ? await fetchSiblingNodes(member) : [];
  const descendantsTree = includeDescendants
    ? await fetchFamilyTree(memberId, maxDepth, new Set(), 0, "DESCENDANTS")
    : null;

  return {
    member,
    parents,
    siblings,
    children: descendantsTree?.children || [],
    spouses: [],
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
