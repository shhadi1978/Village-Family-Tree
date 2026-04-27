import { NextRequest, NextResponse } from "next/server";
import { fetchFamilyTree, type FamilyTreeNode } from "@/lib/tree-logic";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const memberId = params?.memberId;
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const tree = await fetchFamilyTree(memberId, 10, new Set(), 0, "DESCENDANTS");
    if (!tree) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const generations: Array<{
      level: number;
      members: Array<{ id: string; fullName: string; relation: "root" | "descendant" | "spouse"; parentIds: string[] }>;
    }> = [];

    const membersByLevel = new Map<number, Array<{ id: string; fullName: string; relation: "root" | "descendant" | "spouse"; parentIds: string[] }>>();
    const visitedDescendants = new Set<string>();
    const visitedSpouses = new Set<string>();

    const queue: Array<{ node: FamilyTreeNode; level: number; parentIds: string[]; relation: "root" | "descendant" }> = [
      { node: tree, level: 0, parentIds: [], relation: "root" },
    ];

    const pushMember = (
      level: number,
      payload: { id: string; fullName: string; relation: "root" | "descendant" | "spouse"; parentIds: string[] }
    ) => {
      const current = membersByLevel.get(level) || [];
      if (!current.some((item) => item.id === payload.id && item.relation === payload.relation)) {
        current.push(payload);
        membersByLevel.set(level, current);
      }
    };

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const currentId = current.node.member.id;
      if (visitedDescendants.has(currentId)) {
        continue;
      }
      visitedDescendants.add(currentId);

      pushMember(current.level, {
        id: current.node.member.id,
        fullName: current.node.member.fullName,
        relation: current.relation,
        parentIds: current.parentIds,
      });

      current.node.spouses.forEach((spouse) => {
        if (visitedSpouses.has(spouse.member.id)) return;
        visitedSpouses.add(spouse.member.id);
        pushMember(current.level, {
          id: spouse.member.id,
          fullName: spouse.member.fullName,
          relation: "spouse",
          parentIds: [],
        });
      });

      current.node.marriages.forEach((marriage) => {
        const spouseId = marriage.spouse?.member.id;
        marriage.children.forEach((child) => {
          const parentIds = spouseId
            ? [current.node.member.id, spouseId]
            : [current.node.member.id];
          queue.push({
            node: child,
            level: current.level + 1,
            parentIds,
            relation: "descendant",
          });
        });
      });

      current.node.children.forEach((child) => {
        queue.push({
          node: child,
          level: current.level + 1,
          parentIds: [current.node.member.id],
          relation: "descendant",
        });
      });
    }

    const maxLevel = Math.max(...Array.from(membersByLevel.keys()));
    for (let level = 0; level <= maxLevel; level += 1) {
      generations.push({
        level,
        members: membersByLevel.get(level) || [],
      });
    }

    return NextResponse.json(
      {
        targetId: tree.member.id,
        targetName: tree.member.fullName,
        generations,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[tree-order] error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "tree-order failed" },
      { status: 500 }
    );
  }
}
