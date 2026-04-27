import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import fetchFamilyTree from "@/lib/tree-logic";
import convertTreeToFlow, { validateTreeData } from "@/lib/family-tree/treeToReactFlow";
import applyDagreLayout from "@/lib/family-tree/layoutEngine";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { villageId: string } }
) {
  const start = Date.now();

  try {
    const villageId = params?.villageId;

    if (!villageId) {
      return NextResponse.json({ error: "Village ID is required" }, { status: 400 });
    }

    const village = await prisma.village.findUnique({
      where: { id: villageId },
      select: { id: true },
    });

    if (!village) {
      return NextResponse.json({ error: "Village not found" }, { status: 404 });
    }

    let founder = await prisma.member.findFirst({
      where: { villageId, isFounder: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!founder) {
      founder = await prisma.member.findFirst({
        where: { villageId },
        orderBy: { createdAt: "asc" },
        select: { id: true, firstName: true, lastName: true },
      });
    }

    if (!founder) {
      return NextResponse.json({ nodes: [], edges: [], memberCount: 0 }, { status: 200 });
    }

    const treeData = await fetchFamilyTree(
      founder.id,
      9,
      new Set(),
      0,
      'FULL'
    );

    if (!treeData) {
      return NextResponse.json({ nodes: [], edges: [], memberCount: 0 }, { status: 200 });
    }

    const { nodes: flowNodes, edges: flowEdges } = convertTreeToFlow(treeData);
    const { nodes, edges } = applyDagreLayout(flowNodes, flowEdges);

    validateTreeData(nodes, edges);

    const memberCount = nodes.filter((n) => n.type === "memberNode").length;
    const founderFullName = `${founder.firstName || ''} ${founder.lastName || ''}`.trim() || 'Unknown';

    console.log('=== TREE BUILD SUMMARY ===')
    console.log('Founder:', founderFullName, founder.id)
    console.log('Raw tree built successfully')
    console.log('Nodes:', nodes.length)
    console.log('Edges:', edges.length)
    console.log('Member nodes:', nodes.filter(n=>n.type==='memberNode').length)
    console.log('Marriage nodes:', nodes.filter(n=>n.type==='marriageNode').length)
    console.log(`Total time: ${Date.now() - start}ms`)
    console.log('==========================')

    return NextResponse.json({ nodes, edges, memberCount }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build village tree";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
