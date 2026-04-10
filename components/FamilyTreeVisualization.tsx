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
  onRefresh?: () => void;
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
  marriages: Array<{
    marriageId: string;
    spouse: TreeNodeUI | null;
    children: TreeNodeUI[];
  }>;
};

const HORIZONTAL_GAP = 280;
const VERTICAL_GAP = 220;
const MARRIAGE_OFFSET_Y = 92;

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
  const allChildren = [
    ...node.children,
    ...node.marriages.flatMap((marriage) => marriage.children),
  ];

  if (allChildren.length === 0) {
    return 1;
  }

  return [...allChildren].sort(compareTreeNodes).reduce((total, child) => {
    return total + countBranchUnits(child);
  }, 0);
}

function getHorizontalGap(node: TreeNodeUI) {
  const marriageCount = node.marriages.length;
  const maxMarriageChildren = node.marriages.reduce(
    (max, marriage) => Math.max(max, marriage.children.length),
    0
  );
  const directChildrenCount = node.children.length;
  const densityBoost = Math.max(maxMarriageChildren, directChildrenCount);

  return (
    HORIZONTAL_GAP +
    Math.max(0, marriageCount - 1) * 48 +
    Math.max(0, densityBoost - 2) * 24
  );
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
    spouse: { stroke: "#e879f9", strokeWidth: 3, strokeDasharray: "10 6" },
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
function convertTreeToGraph(node: TreeNodeUI | null, familyName?: string, onRefresh?: () => void) {
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
      data: { member: treeNode.member, familyName, onRefresh },
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

  function getSortedMarriageGroups(treeNode: TreeNodeUI) {
    return [...treeNode.marriages].sort((a, b) => {
      if (!a.spouse && !b.spouse) return 0;
      if (!a.spouse) return 1;
      if (!b.spouse) return -1;
      return compareTreeNodes(a.spouse, b.spouse);
    });
  }

  function placeSpouses(treeNode: TreeNodeUI, memberX: number, memberY: number) {
    const sortedMarriages = getSortedMarriageGroups(treeNode);
    const localHorizontalGap = getHorizontalGap(treeNode);

    const marriageLayouts = sortedMarriages.map((marriage, index) => {
      const spouse = marriage.spouse;
      const spouseX = memberX + (index + 1) * localHorizontalGap;
      const marriageX = memberX + (index + 0.5) * localHorizontalGap;
      const marriageNodeId = spouse
        ? getMarriageNodeId(treeNode.member.id, spouse.member.id)
        : `${treeNode.member.id}__${marriage.marriageId}`;

      if (spouse) {
        ensureNode(spouse, spouseX, memberY);
      }

      ensureMarriageNode(marriageNodeId, marriageX, memberY + MARRIAGE_OFFSET_Y);

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

      if (spouse) {
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
      }

      return {
        marriageId: marriage.marriageId,
        marriageNodeId,
        anchorX: marriageX,
        children: [...marriage.children].sort(compareTreeNodes),
      };
    });

    return {
      marriageLayouts,
    };
  }

  function getChildSections(
    treeNode: TreeNodeUI,
    memberX: number,
    spouseLayout: ReturnType<typeof placeSpouses>
  ) {
    const sections: Array<{
      sourceId: string;
      anchorX: number;
      children: TreeNodeUI[];
    }> = [];

    // الأبناء المباشرين من الآباء الوحيدين
    const directChildren = [...treeNode.children].sort(compareTreeNodes);
    if (directChildren.length > 0) {
      sections.push({
        sourceId: treeNode.member.id,
        anchorX: memberX,
        children: directChildren,
      });
    }

    // الأبناء من كل مجموعة زواج
    spouseLayout.marriageLayouts.forEach((layout) => {
      if (layout.children.length === 0) {
        return;
      }

      sections.push({
        sourceId: layout.marriageNodeId,
        anchorX: layout.anchorX,
        children: layout.children,
      });
    });

    return sections;
  }

  function placeDescendants(treeNode: TreeNodeUI, centerX: number, levelY: number) {
    const memberId = treeNode.member.id;
    const localHorizontalGap = getHorizontalGap(treeNode);

    if (processedMembers.has(memberId)) {
      ensureNode(treeNode, centerX, levelY);
      return;
    }

    processedMembers.add(memberId);
    ensureNode(treeNode, centerX, levelY);
    const spouseLayout = placeSpouses(treeNode, centerX, levelY);
    const childSections = getChildSections(treeNode, centerX, spouseLayout);

    if (childSections.length === 0) {
      return;
    }

    childSections.forEach((section) => {
      const totalUnits = section.children.reduce(
        (sum, child) => sum + countBranchUnits(child),
        0
      );
      let cursorX = section.anchorX - ((totalUnits - 1) * localHorizontalGap) / 2;

      section.children.forEach((child) => {
        const branchUnits = countBranchUnits(child);
        const childCenterX = cursorX + ((branchUnits - 1) * localHorizontalGap) / 2;
        const childY = levelY + VERTICAL_GAP;

        placeDescendants(child, childCenterX, childY);
        ensureEdge(
          buildEdge(
            `${section.sourceId}-${child.member.id}-child`,
            section.sourceId,
            child.member.id,
            "child",
            "source-bottom",
            "target-top"
          )
        );

        cursorX += branchUnits * localHorizontalGap;
      });
    });
  }

  function placeFocusedTree(treeNode: TreeNodeUI) {
    const rootX = 0;
    const rootY = 0;
    const localHorizontalGap = getHorizontalGap(treeNode);
    ensureNode(treeNode, rootX, rootY);
    processedMembers.add(treeNode.member.id);
    const spouseLayout = placeSpouses(treeNode, rootX, rootY);
    const childSections = getChildSections(treeNode, rootX, spouseLayout);

    const sortedParents = [...treeNode.parents].sort(compareTreeNodes);
    const parentsStartX = rootX - ((sortedParents.length - 1) * localHorizontalGap) / 2;
    sortedParents.forEach((parent, index) => {
      const parentX = parentsStartX + index * localHorizontalGap;
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

      const siblingX = rootX + (slot - Math.floor(siblingSlots / 2)) * localHorizontalGap;
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
    childSections.forEach((section) => {
      const totalUnits = section.children.reduce(
        (sum, child) => sum + countBranchUnits(child),
        0
      );
      let cursorX = section.anchorX - ((Math.max(totalUnits, 1) - 1) * localHorizontalGap) / 2;

      section.children.forEach((child) => {
        const branchUnits = countBranchUnits(child);
        const childCenterX = cursorX + ((branchUnits - 1) * localHorizontalGap) / 2;
        placeDescendants(child, childCenterX, descendantsStartY);
        ensureEdge(
          buildEdge(
            `${section.sourceId}-${child.member.id}-child-root`,
            section.sourceId,
            child.member.id,
            "child",
            "source-bottom",
            "target-top"
          )
        );
        cursorX += branchUnits * localHorizontalGap;
      });
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
  onRefresh,
}: FamilyTreeVisualizationProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (treeData && !loading) {
      const { nodes: newNodes, edges: newEdges } = convertTreeToGraph(treeData, familyName, onRefresh);

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
