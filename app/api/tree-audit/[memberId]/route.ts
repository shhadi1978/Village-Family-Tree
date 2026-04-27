import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type RelationshipType = "PARENT" | "SPOUSE";

type MemberLite = {
  id: string;
  fullName: string;
  familyId: string;
  villageId: string;
  gender: string;
  isFounder: boolean;
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const memberId = params?.memberId;
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const target = await db.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        fullName: true,
        familyId: true,
        villageId: true,
        gender: true,
        isFounder: true,
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const familyMembers = await db.member.findMany({
      where: { familyId: target.familyId },
      select: {
        id: true,
        fullName: true,
        familyId: true,
        villageId: true,
        gender: true,
        isFounder: true,
      },
    });

    const familyMemberIds = new Set(familyMembers.map((m) => m.id));

    const relationships = await db.relationship.findMany({
      where: {
        OR: [
          { fromMemberId: { in: Array.from(familyMemberIds) } },
          { toMemberId: { in: Array.from(familyMemberIds) } },
        ],
      },
      select: {
        id: true,
        type: true,
        fromMemberId: true,
        toMemberId: true,
        villageId: true,
        marriageId: true,
        createdAt: true,
      },
    });

    const internalRelationships = relationships.filter(
      (r) => familyMemberIds.has(r.fromMemberId) && familyMemberIds.has(r.toMemberId)
    );

    const marriages = await db.marriage.findMany({
      where: {
        OR: [
          { partnerAId: { in: Array.from(familyMemberIds) } },
          { partnerBId: { in: Array.from(familyMemberIds) } },
        ],
      },
      select: {
        id: true,
        villageId: true,
        partnerAId: true,
        partnerBId: true,
      },
    });

    const marriagesById = new Map(marriages.map((m) => [m.id, m]));

    const crossFamilyRelationships = relationships
      .filter((r) => familyMemberIds.has(r.fromMemberId) !== familyMemberIds.has(r.toMemberId))
      .map((r) => ({
        id: r.id,
        type: r.type,
        fromMemberId: r.fromMemberId,
        toMemberId: r.toMemberId,
      }));

    const parentByChild = new Map<string, string[]>();
    internalRelationships.forEach((r) => {
      if (r.type !== "PARENT") return;
      const arr = parentByChild.get(r.toMemberId) || [];
      arr.push(r.fromMemberId);
      parentByChild.set(r.toMemberId, arr);
    });

    const childrenWithMoreThanTwoParents: Array<{ childId: string; parentIds: string[] }> = [];
    parentByChild.forEach((parents, childId) => {
      const uniqueParents = Array.from(new Set(parents));
      if (uniqueParents.length > 2) {
        childrenWithMoreThanTwoParents.push({ childId, parentIds: uniqueParents });
      }
    });

    const spouseEdges = internalRelationships.filter((r) => r.type === "SPOUSE");
    const spouseDirected = new Set(spouseEdges.map((r) => `${r.fromMemberId}->${r.toMemberId}`));
    const oneWaySpouseLinks = spouseEdges
      .filter((r) => !spouseDirected.has(`${r.toMemberId}->${r.fromMemberId}`))
      .map((r) => ({
        id: r.id,
        fromMemberId: r.fromMemberId,
        toMemberId: r.toMemberId,
      }));

    const spousePairCount = new Map<string, number>();
    spouseEdges.forEach((r) => {
      const key = pairKey(r.fromMemberId, r.toMemberId);
      spousePairCount.set(key, (spousePairCount.get(key) || 0) + 1);
    });

    const duplicateSpousePairs: Array<{ pair: string; count: number }> = [];
    spousePairCount.forEach((count, key) => {
      if (count > 2) {
        duplicateSpousePairs.push({ pair: key, count });
      }
    });

    const marriageLinkIssues: Array<Record<string, string>> = [];
    internalRelationships
      .filter((r) => r.type === "PARENT" && r.marriageId)
      .forEach((r) => {
        const marriage = r.marriageId ? marriagesById.get(r.marriageId) : null;
        if (!marriage) {
          marriageLinkIssues.push({
            relationshipId: r.id,
            issue: "missing-marriage-record",
            marriageId: String(r.marriageId),
          });
          return;
        }

        if (r.fromMemberId !== marriage.partnerAId && r.fromMemberId !== marriage.partnerBId) {
          marriageLinkIssues.push({
            relationshipId: r.id,
            issue: "parent-not-in-marriage-partners",
            marriageId: marriage.id,
            parentId: r.fromMemberId,
            partnerAId: marriage.partnerAId,
            partnerBId: marriage.partnerBId,
          });
        }
      });

    const adjacency = new Map<string, Set<string>>();
    familyMembers.forEach((m) => adjacency.set(m.id, new Set()));
    internalRelationships.forEach((r) => {
      adjacency.get(r.fromMemberId)?.add(r.toMemberId);
      adjacency.get(r.toMemberId)?.add(r.fromMemberId);
    });

    const visited = new Set<string>();
    const queue: string[] = [target.id];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      (adjacency.get(current) || new Set()).forEach((next) => {
        if (!visited.has(next)) queue.push(next);
      });
    }

    const disconnectedMembers = familyMembers
      .filter((m) => !visited.has(m.id))
      .map((m) => ({ id: m.id, fullName: m.fullName }));

    const villageMismatchMembers = familyMembers
      .filter((m) => m.villageId !== target.villageId)
      .map((m) => ({ id: m.id, fullName: m.fullName, villageId: m.villageId }));

    const report = {
      targetMember: target,
      scope: {
        familyId: target.familyId,
        villageId: target.villageId,
      },
      counts: {
        familyMembers: familyMembers.length,
        allRelationshipsTouchingFamily: relationships.length,
        internalRelationships: internalRelationships.length,
        parentRelationshipsInternal: internalRelationships.filter((r) => r.type === "PARENT").length,
        spouseRelationshipsInternal: spouseEdges.length,
        marriagesTouchingFamily: marriages.length,
      },
      integrity: {
        crossFamilyRelationshipsCount: crossFamilyRelationships.length,
        oneWaySpouseLinksCount: oneWaySpouseLinks.length,
        duplicateSpousePairsCount: duplicateSpousePairs.length,
        childrenWithMoreThanTwoParentsCount: childrenWithMoreThanTwoParents.length,
        marriageLinkIssuesCount: marriageLinkIssues.length,
        disconnectedMembersFromTargetCount: disconnectedMembers.length,
        villageMismatchMembersCount: villageMismatchMembers.length,
      },
      details: {
        crossFamilyRelationships,
        oneWaySpouseLinks,
        duplicateSpousePairs,
        childrenWithMoreThanTwoParents,
        marriageLinkIssues,
        disconnectedMembers,
        villageMismatchMembers,
      },
    };

    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    console.error("[tree-audit] error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "tree-audit failed",
      },
      { status: 500 }
    );
  }
}
