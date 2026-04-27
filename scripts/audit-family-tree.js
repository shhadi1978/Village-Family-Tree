/*
  Usage:
  node scripts/audit-family-tree.js <memberId>
*/

const { PrismaClient } = require('@prisma/client');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

function pairKey(a, b) {
  return [a, b].sort().join('::');
}

async function main() {
  const memberId = process.argv[2];
  if (!memberId) {
    console.error('Missing memberId. Usage: node scripts/audit-family-tree.js <memberId>');
    process.exit(1);
  }

  const target = await prisma.member.findUnique({
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
    console.error(`Member not found: ${memberId}`);
    process.exit(2);
  }

  const familyMembers = await prisma.member.findMany({
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

  const familyRelationships = await prisma.relationship.findMany({
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

  const internalRelationships = familyRelationships.filter(
    (r) => familyMemberIds.has(r.fromMemberId) && familyMemberIds.has(r.toMemberId)
  );

  const marriages = await prisma.marriage.findMany({
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

  const missingMemberRefs = [];
  const selfRelationships = [];
  for (const r of familyRelationships) {
    if (r.fromMemberId === r.toMemberId) {
      selfRelationships.push(r.id);
    }
    const fromKnown = familyMemberIds.has(r.fromMemberId);
    const toKnown = familyMemberIds.has(r.toMemberId);
    if (!fromKnown && !toKnown) {
      missingMemberRefs.push(r.id);
    }
  }

  const crossFamilyRelationships = familyRelationships
    .filter((r) => familyMemberIds.has(r.fromMemberId) !== familyMemberIds.has(r.toMemberId))
    .map((r) => ({
      id: r.id,
      type: r.type,
      fromMemberId: r.fromMemberId,
      toMemberId: r.toMemberId,
    }));

  const parentByChild = new Map();
  for (const r of internalRelationships) {
    if (r.type !== 'PARENT') continue;
    const arr = parentByChild.get(r.toMemberId) || [];
    arr.push(r.fromMemberId);
    parentByChild.set(r.toMemberId, arr);
  }

  const childrenWithMoreThanTwoParents = [];
  for (const [childId, parents] of parentByChild.entries()) {
    const unique = Array.from(new Set(parents));
    if (unique.length > 2) {
      childrenWithMoreThanTwoParents.push({ childId, parentIds: unique });
    }
  }

  const spouseEdges = internalRelationships.filter((r) => r.type === 'SPOUSE');
  const spouseDirected = new Set(spouseEdges.map((r) => `${r.fromMemberId}->${r.toMemberId}`));
  const oneWaySpouseLinks = [];
  for (const r of spouseEdges) {
    const reverse = `${r.toMemberId}->${r.fromMemberId}`;
    if (!spouseDirected.has(reverse)) {
      oneWaySpouseLinks.push({
        id: r.id,
        fromMemberId: r.fromMemberId,
        toMemberId: r.toMemberId,
      });
    }
  }

  const duplicateSpousePairs = [];
  const spousePairCount = new Map();
  for (const r of spouseEdges) {
    const key = pairKey(r.fromMemberId, r.toMemberId);
    spousePairCount.set(key, (spousePairCount.get(key) || 0) + 1);
  }
  for (const [key, count] of spousePairCount.entries()) {
    if (count > 2) {
      duplicateSpousePairs.push({ pair: key, count });
    }
  }

  const marriageLinkIssues = [];
  const parentWithMarriageId = internalRelationships.filter((r) => r.type === 'PARENT' && r.marriageId);
  for (const r of parentWithMarriageId) {
    const m = marriagesById.get(r.marriageId);
    if (!m) {
      marriageLinkIssues.push({
        relationshipId: r.id,
        issue: 'missing-marriage-record',
        marriageId: r.marriageId,
      });
      continue;
    }

    if (r.fromMemberId !== m.partnerAId && r.fromMemberId !== m.partnerBId) {
      marriageLinkIssues.push({
        relationshipId: r.id,
        issue: 'parent-not-in-marriage-partners',
        marriageId: r.marriageId,
        parentId: r.fromMemberId,
        partnerAId: m.partnerAId,
        partnerBId: m.partnerBId,
      });
    }
  }

  // Connectivity inside family graph (undirected over internal relations)
  const adj = new Map();
  for (const m of familyMembers) adj.set(m.id, new Set());
  for (const r of internalRelationships) {
    adj.get(r.fromMemberId)?.add(r.toMemberId);
    adj.get(r.toMemberId)?.add(r.fromMemberId);
  }

  const visited = new Set();
  const queue = [target.id];
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || visited.has(cur)) continue;
    visited.add(cur);
    for (const next of adj.get(cur) || []) {
      if (!visited.has(next)) queue.push(next);
    }
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
      allRelationshipsTouchingFamily: familyRelationships.length,
      internalRelationships: internalRelationships.length,
      parentRelationshipsInternal: internalRelationships.filter((r) => r.type === 'PARENT').length,
      spouseRelationshipsInternal: spouseEdges.length,
      marriagesTouchingFamily: marriages.length,
    },
    integrity: {
      missingMemberRefsCount: missingMemberRefs.length,
      selfRelationshipsCount: selfRelationships.length,
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

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error('Audit failed:', error);
    process.exit(99);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
