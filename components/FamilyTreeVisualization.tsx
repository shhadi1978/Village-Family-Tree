"use client";

import { useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  MiniMap,
  useReactFlow,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import MemberNode from "./nodes/MemberNode";
import MarriageNode from "./nodes/MarriageNode";

const nodeTypes = {
  member: MemberNode,
  marriage: MarriageNode,
};

interface FamilyTreeVisualizationProps {
  treeData: TreeNodeUI | null;
  loading?: boolean;
  familyName?: string;
}

type TreeMemberUI = {
  id: string;
  fullName: string;
  nickname?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | Date | null;
  dateOfDeath?: string | Date | null;
  photoUrl?: string | null;
};

type TreeNodeUI = {
  member: TreeMemberUI;
  parents: TreeNodeUI[];
  siblings: TreeNodeUI[];
  children: TreeNodeUI[];
  spouses: TreeNodeUI[];
};

const HORIZONTAL_GAP = 280;
const VERTICAL_GAP = 220;

function getMarriageNodeId(memberId: string, spouseId: string) {
  return [memberId, spouseId].sort().join("__marriage__");
}

function compareTreeNodes(a: TreeNodeUI, b: TreeNodeUI) {
  const timeA = a.member.dateOfBirth ? new Date(a.member.dateOfBirth).getTime() : Number.POSITIVE_INFINITY;
  const timeB = b.member.dateOfBirth ? new Date(b.member.dateOfBirth).getTime() : Number.POSITIVE_INFINITY;

  if (timeA !== timeB) {
    return timeA - timeB;
  }

  return String(a.member.fullName || "").localeCompare(String(b.member.fullName || ""), "ar");
}

function countBranchUnits(node: TreeNodeUI): number {
  if (!node.children || node.children.length === 0) {
    return 1;
  }

  return [...node.children].sort(compareTreeNodes).reduce((total, child) => {
    return total + countBranchUnits(child);
  }, 0);
}

function buildEdge(
  id: string,
  source: string,
  target: string,
  relation: "parent" | "child" | "sibling" | "spouse",
  sourceHandle?: string,
  targetHandle?: string
): Edge {
  const styles = {
    parent: { stroke: "#60a5fa", strokeWidth: 2 },
    child: { stroke: "#34d399", strokeWidth: 2 },
    sibling: { stroke: "#f59e0b", strokeWidth: 1.8, strokeDasharray: "6 4" },
    spouse: { stroke: "#a78bfa", strokeWidth: 2 },
  };

  const markerColor =
    relation === "parent"
      ? "#60a5fa"
      : relation === "child"
        ? "#34d399"
        : relation === "sibling"
          ? "#f59e0b"
          : undefined;

  return {
    id,
    source,
    target,
    type: "smoothstep",
    animated: false,
    sourceHandle,
    targetHandle,
    style: styles[relation],
    ...(markerColor
      ? {
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: markerColor,
          },
        }
      : {}),
  };
}

/**
 * Convert family tree data to ReactFlow nodes and edges
 */
function convertTreeToGraph(node: TreeNodeUI | null, familyName?: string) {
  const nodeMap = new Map<string, Node>();
  const edgeMap = new Map<string, Edge>();
  const processedMembers = new Set<string>();

  function ensureNode(treeNode: TreeNodeUI, x = 0, y = 0) {
    const memberId = treeNode.member.id;

    const existing = nodeMap.get(memberId);
    if (existing) {
      existing.position = { x, y };
      return;
    }

    nodeMap.set(memberId, {
      id: memberId,
      data: { member: treeNode.member, familyName },
      position: { x, y },
      type: "member",
      draggable: true,
    });
  }

  function ensureEdge(edge: Edge) {
    if (!edgeMap.has(edge.id)) {
      edgeMap.set(edge.id, edge);
    }
  }

  function ensureMarriageNode(id: string, x: number, y: number) {
    const existing = nodeMap.get(id);
    if (existing) {
      existing.position = { x, y };
      return;
    }

    nodeMap.set(id, {
      id,
      data: {},
      position: { x, y },
      type: "marriage",
      draggable: false,
      selectable: false,
    });
  }

  function placeSpouses(treeNode: TreeNodeUI, memberX: number, memberY: number) {
    const sortedSpouses = [...treeNode.spouses].sort(compareTreeNodes);
    const marriageNodeIds: string[] = [];

    sortedSpouses.forEach((spouse, index) => {
      const spouseX = memberX + (index + 1) * HORIZONTAL_GAP;
      ensureNode(spouse, spouseX, memberY);

      const marriageNodeId = getMarriageNodeId(treeNode.member.id, spouse.member.id);
      const marriageX = memberX + (index + 0.5) * HORIZONTAL_GAP;
      ensureMarriageNode(marriageNodeId, marriageX, memberY + 78);
      marriageNodeIds.push(marriageNodeId);

      ensureEdge(
        buildEdge(
          `${treeNode.member.id}-${marriageNodeId}-spouse-link`,
          treeNode.member.id,
          marriageNodeId,
          "spouse",
          "source-right",
          "target-left"
        )
      );

      ensureEdge(
        buildEdge(
          `${spouse.member.id}-${marriageNodeId}-spouse-link`,
          spouse.member.id,
          marriageNodeId,
          "spouse",
          "source-left",
          "target-right"
        )
      );
    });

    return {
      spouseCount: sortedSpouses.length,
      primaryMarriageNodeId:
        sortedSpouses.length === 1 ? marriageNodeIds[0] : null,
      childAnchorX:
        sortedSpouses.length === 1 ? memberX + HORIZONTAL_GAP / 2 : memberX,
    };
  }

  function placeDescendants(treeNode: TreeNodeUI, centerX: number, levelY: number) {
    const memberId = treeNode.member.id;

    if (processedMembers.has(memberId)) {
      ensureNode(treeNode, centerX, levelY);
      return;
    }

    processedMembers.add(memberId);
    ensureNode(treeNode, centerX, levelY);
    const spouseLayout = placeSpouses(treeNode, centerX, levelY);

    const sortedChildren = [...treeNode.children].sort(compareTreeNodes);
    if (sortedChildren.length === 0) {
      return;
    }

    const totalUnits = sortedChildren.reduce((sum, child) => sum + countBranchUnits(child), 0);
    let cursorX = spouseLayout.childAnchorX - ((totalUnits - 1) * HORIZONTAL_GAP) / 2;

    sortedChildren.forEach((child) => {
      const branchUnits = countBranchUnits(child);
      const childCenterX = cursorX + ((branchUnits - 1) * HORIZONTAL_GAP) / 2;
      const childY = levelY + VERTICAL_GAP;

      placeDescendants(child, childCenterX, childY);
      ensureEdge(
        buildEdge(
          `${(spouseLayout.primaryMarriageNodeId || memberId)}-${child.member.id}-child`,
          spouseLayout.primaryMarriageNodeId || memberId,
          child.member.id,
          "child",
          "source-bottom",
          "target-top"
        )
      );

      cursorX += branchUnits * HORIZONTAL_GAP;
    });
  }

  function placeFocusedTree(treeNode: TreeNodeUI) {
    const rootX = 0;
    const rootY = 0;
    ensureNode(treeNode, rootX, rootY);
    processedMembers.add(treeNode.member.id);
    const spouseLayout = placeSpouses(treeNode, rootX, rootY);

    const sortedParents = [...treeNode.parents].sort(compareTreeNodes);
    const parentsStartX = rootX - ((sortedParents.length - 1) * HORIZONTAL_GAP) / 2;
    sortedParents.forEach((parent, index) => {
      const parentX = parentsStartX + index * HORIZONTAL_GAP;
      const parentY = rootY - VERTICAL_GAP;
      ensureNode(parent, parentX, parentY);
      ensureEdge(
        buildEdge(
          `${parent.member.id}-${treeNode.member.id}-parent`,
          parent.member.id,
          treeNode.member.id,
          "parent",
          "source-bottom",
          "target-top"
        )
      );
    });

    const sortedSiblings = [...treeNode.siblings].sort(compareTreeNodes);
    const siblingsY = rootY + VERTICAL_GAP;
    const siblingSlots = sortedSiblings.length + 1;
    let siblingIndex = 0;
    for (let slot = 0; slot < siblingSlots; slot += 1) {
      if (slot === Math.floor(siblingSlots / 2)) {
        continue;
      }

      const sibling = sortedSiblings[siblingIndex];
      if (!sibling) {
        continue;
      }

      const siblingX = rootX + (slot - Math.floor(siblingSlots / 2)) * HORIZONTAL_GAP;
      ensureNode(sibling, siblingX, siblingsY);
      ensureEdge(
        buildEdge(
          `${treeNode.member.id}-${sibling.member.id}-sibling`,
          treeNode.member.id,
          sibling.member.id,
          "sibling",
          siblingX > rootX ? "source-right" : "source-left",
          siblingX > rootX ? "target-left" : "target-right"
        )
      );
      siblingIndex += 1;
    }

    const descendantsStartY = sortedSiblings.length > 0 ? rootY + VERTICAL_GAP * 2 : rootY + VERTICAL_GAP;
    const sortedChildren = [...treeNode.children].sort(compareTreeNodes);
    const totalUnits = sortedChildren.reduce((sum, child) => sum + countBranchUnits(child), 0);
    let cursorX = spouseLayout.childAnchorX - ((Math.max(totalUnits, 1) - 1) * HORIZONTAL_GAP) / 2;

    sortedChildren.forEach((child) => {
      const branchUnits = countBranchUnits(child);
      const childCenterX = cursorX + ((branchUnits - 1) * HORIZONTAL_GAP) / 2;
      placeDescendants(child, childCenterX, descendantsStartY);
      ensureEdge(
        buildEdge(
          `${(spouseLayout.primaryMarriageNodeId || treeNode.member.id)}-${child.member.id}-child-root`,
          spouseLayout.primaryMarriageNodeId || treeNode.member.id,
          child.member.id,
          "child",
          "source-bottom",
          "target-top"
        )
      );
      cursorX += branchUnits * HORIZONTAL_GAP;
    });
  }

  if (node) {
    placeFocusedTree(node);
  }

  return { nodes: Array.from(nodeMap.values()), edges: Array.from(edgeMap.values()) };
}

function FamilyTreeFlowCanvas({
  treeData,
  loading = false,
  familyName,
}: FamilyTreeVisualizationProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (treeData && !loading) {
      const { nodes: newNodes, edges: newEdges } = convertTreeToGraph(treeData, familyName);

      setNodes(newNodes);
      setEdges(newEdges);

      // Auto-fit view after a brief delay to allow rendering
      setTimeout(() => fitView(), 100);
    }
  }, [treeData, loading, familyName, setNodes, setEdges, fitView]);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-900">
        <div className="text-slate-400">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          جاري تحميل شجرة العائلة...
        </div>
      </div>
    );
  }

  if (!treeData || nodes.length === 0) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-slate-400">
          <p>لم يتم اختيار فرد أو أن بيانات الشجرة غير متاحة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-slate-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={{
          type: "smoothstep",
          zIndex: 1,
        }}
      >
        <Background color="#334155" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={() => "#6366f1"}
          nodeStrokeColor={() => "#1e293b"}
          nodeBorderRadius={8}
          maskColor="rgba(0, 0, 0, 0.5)"
        />

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-slate-800/95 border border-slate-700 rounded-lg p-3 md:p-4 text-sm max-w-52">
          <h4 className="text-white font-semibold mb-3">المفتاح</h4>
          <div className="space-y-2 text-slate-300">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>علاقة أب/أم</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>علاقة ابن/ابنة</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded"></div>
              <span>أخ/أخت</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span>علاقة زواج</span>
            </div>
          </div>
        </div>
      </ReactFlow>
    </div>
  );
}

export default function FamilyTreeVisualization(props: FamilyTreeVisualizationProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeFlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
