"use client";

import { useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import MemberNode from "./nodes/MemberNode";
import MarriageNode from "./nodes/MarriageNode";
import BusNode from "./nodes/BusNode";

const nodeTypes = {
  member: MemberNode,
  marriage: MarriageNode,
  bus: BusNode,
};

interface FamilyTreeVisualizationProps {
  treeData: TreeNodeUI | null;
  loading?: boolean;
  familyName?: string;
  onRefresh?: () => void;
}

type DisplayMode = "detailed" | "simplified";

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

type ChildSection = {
  sourceId: string;
  anchorX: number;
  children: TreeNodeUI[];
};

const HORIZONTAL_GAP = 280;
const VERTICAL_GAP = 220;
const MARRIAGE_OFFSET_Y = 92;
const BUS_OFFSET_Y = 148;

function getMarriageNodeId(memberId: string, spouseId: string) {
  return [memberId, spouseId].sort().join("__marriage__");
}

function getBusNodeId(sourceId: string, children: TreeNodeUI[]) {
  const firstChildId = children[0]?.member.id || "first";
  const lastChildId = children[children.length - 1]?.member.id || "last";
  return `${sourceId}__bus__${firstChildId}__${lastChildId}__${children.length}`;
}

function getSpouseSlot(index: number) {
  const magnitude = Math.floor(index / 2) + 1;
  const direction = index % 2 === 0 ? 1 : -1;
  return magnitude * direction;
}

function compareTreeNodes(a: TreeNodeUI, b: TreeNodeUI) {
  const timeA = a.member.dateOfBirth
    ? new Date(a.member.dateOfBirth).getTime()
    : Number.POSITIVE_INFINITY;
  const timeB = b.member.dateOfBirth
    ? new Date(b.member.dateOfBirth).getTime()
    : Number.POSITIVE_INFINITY;

  if (timeA !== timeB) {
    return timeA - timeB;
  }

  return String(a.member.fullName || "").localeCompare(
    String(b.member.fullName || ""),
    "ar"
  );
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

function getHorizontalGap(node: TreeNodeUI, displayMode: DisplayMode) {
  const marriageCount = node.marriages.length;
  const maxMarriageChildren = node.marriages.reduce(
    (max, marriage) => Math.max(max, marriage.children.length),
    0
  );
  const directChildrenCount = node.children.length;
  const densityBoost = Math.max(maxMarriageChildren, directChildrenCount);
  const modeBoost = displayMode === "simplified" ? 36 : 0;

  return (
    HORIZONTAL_GAP +
    Math.max(0, marriageCount - 1) * 48 +
    Math.max(0, densityBoost - 2) * 24 +
    modeBoost
  );
}

function buildEdge(
  id: string,
  source: string,
  target: string,
  relation: "parent" | "child" | "sibling" | "spouse" | "bus",
  sourceHandle?: string,
  targetHandle?: string
): Edge {
  const styles = {
    parent: { stroke: "#60a5fa", strokeWidth: 2 },
    child: { stroke: "#34d399", strokeWidth: 2 },
    sibling: { stroke: "#f59e0b", strokeWidth: 1.8, strokeDasharray: "6 4" },
    spouse: { stroke: "#e879f9", strokeWidth: 3, strokeDasharray: "10 6" },
    bus: { stroke: "#4ade80", strokeWidth: 2.4 },
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
    type: relation === "bus" ? "straight" : "smoothstep",
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

function convertTreeToGraph(
  node: TreeNodeUI | null,
  familyName?: string,
  onRefresh?: () => void,
  displayMode: DisplayMode = "detailed"
) {
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

  function ensureBusNode(
    id: string,
    centerX: number,
    y: number,
    width: number,
    handleOffsets: number[]
  ) {
    const existing = nodeMap.get(id);
    const position = { x: centerX - width / 2, y };

    if (existing) {
      existing.position = position;
      existing.data = { width, handleOffsets };
      return;
    }

    nodeMap.set(id, {
      id,
      data: { width, handleOffsets },
      position,
      type: "bus",
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
    const localHorizontalGap = getHorizontalGap(treeNode, displayMode);

    const marriageLayouts = sortedMarriages.map((marriage, index) => {
      const spouse = marriage.spouse;
      const spouseSlot = getSpouseSlot(index);
      const spouseX = memberX + spouseSlot * localHorizontalGap;
      const marriageX = memberX + spouseSlot * (localHorizontalGap / 2);
      const marriageNodeId = spouse
        ? getMarriageNodeId(treeNode.member.id, spouse.member.id)
        : `${treeNode.member.id}__${marriage.marriageId}`;
      const memberHandle = spouseSlot > 0 ? "source-right" : "source-left";
      const marriageTargetHandle = spouseSlot > 0 ? "target-left" : "target-right";
      const spouseHandle = spouseSlot > 0 ? "source-left" : "source-right";
      const marriageSpouseTargetHandle = spouseSlot > 0 ? "target-right" : "target-left";

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
          memberHandle,
          marriageTargetHandle
        )
      );

      if (spouse) {
        ensureEdge(
          buildEdge(
            `${spouse.member.id}-${marriageNodeId}-spouse-link`,
            spouse.member.id,
            marriageNodeId,
            "spouse",
            spouseHandle,
            marriageSpouseTargetHandle
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

    return { marriageLayouts };
  }

  function getChildSections(
    treeNode: TreeNodeUI,
    memberX: number,
    spouseLayout: ReturnType<typeof placeSpouses>
  ) {
    const sections: ChildSection[] = [];
    const directChildren = [...treeNode.children].sort(compareTreeNodes);

    if (directChildren.length > 0) {
      sections.push({
        sourceId: treeNode.member.id,
        anchorX: memberX,
        children: directChildren,
      });
    }

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

  function placeChildSections(
    parentNode: TreeNodeUI,
    sections: ChildSection[],
    levelY: number
  ) {
    const localHorizontalGap = getHorizontalGap(parentNode, displayMode);

    sections.forEach((section) => {
      const totalUnits = section.children.reduce(
        (sum, child) => sum + countBranchUnits(child),
        0
      );
      let cursorX =
        section.anchorX - ((Math.max(totalUnits, 1) - 1) * localHorizontalGap) / 2;

      const placements = section.children.map((child) => {
        const branchUnits = countBranchUnits(child);
        const childCenterX = cursorX + ((branchUnits - 1) * localHorizontalGap) / 2;
        cursorX += branchUnits * localHorizontalGap;
        return { child, childCenterX };
      });

      if (placements.length === 0) {
        return;
      }

      const firstChildX = placements[0].childCenterX;
      const lastChildX = placements[placements.length - 1].childCenterX;
      const busWidth = Math.max(72, lastChildX - firstChildX + Math.min(localHorizontalGap * 0.6, 132));
      const busCenterX = (firstChildX + lastChildX) / 2;
      const busNodeId = getBusNodeId(section.sourceId, section.children);
      const busStartX = busCenterX - busWidth / 2;
      const handleOffsets = placements.map(({ childCenterX }) => {
        const ratio = ((childCenterX - busStartX) / busWidth) * 100;
        return Math.max(8, Math.min(92, ratio));
      });

      ensureBusNode(busNodeId, busCenterX, levelY + BUS_OFFSET_Y, busWidth, handleOffsets);
      ensureEdge(
        buildEdge(
          `${section.sourceId}-${busNodeId}-bus`,
          section.sourceId,
          busNodeId,
          "bus",
          "source-bottom",
          "target-top"
        )
      );

      placements.forEach(({ child, childCenterX }, index) => {
        const childY = levelY + VERTICAL_GAP;
        placeDescendants(child, childCenterX, childY);
        ensureEdge(
          buildEdge(
            `${busNodeId}-${child.member.id}-child-${index}`,
            busNodeId,
            child.member.id,
            "child",
            `child-${index}`,
            "target-top"
          )
        );
      });
    });
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
    const childSections = getChildSections(treeNode, centerX, spouseLayout);

    if (childSections.length === 0) {
      return;
    }

    placeChildSections(treeNode, childSections, levelY);
  }

  function placeFocusedTree(treeNode: TreeNodeUI) {
    const rootX = 0;
    const rootY = 0;
    const localHorizontalGap = getHorizontalGap(treeNode, displayMode);
    const showContext = displayMode === "detailed";

    ensureNode(treeNode, rootX, rootY);
    processedMembers.add(treeNode.member.id);

    const spouseLayout = placeSpouses(treeNode, rootX, rootY);
    const childSections = getChildSections(treeNode, rootX, spouseLayout);

    if (showContext) {
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

        const siblingX =
          rootX + (slot - Math.floor(siblingSlots / 2)) * localHorizontalGap;
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
    }

    if (childSections.length > 0) {
      placeChildSections(treeNode, childSections, rootY);
    }
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
  const [displayMode, setDisplayMode] = useState<DisplayMode>("detailed");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (treeData && !loading) {
      const { nodes: newNodes, edges: newEdges } = convertTreeToGraph(
        treeData,
        familyName,
        onRefresh,
        displayMode
      );

      setNodes(newNodes);
      setEdges(newEdges);
      setTimeout(() => fitView({ padding: 0.2 }), 100);
    }
  }, [treeData, loading, familyName, onRefresh, displayMode, setNodes, setEdges, fitView]);

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
          nodeColor={(node) => (node.type === "marriage" ? "#d946ef" : node.type === "bus" ? "#22c55e" : "#6366f1")}
          nodeStrokeColor={() => "#1e293b"}
          nodeBorderRadius={8}
          maskColor="rgba(0, 0, 0, 0.5)"
        />

        <div className="absolute top-4 left-4 bg-slate-800/95 border border-slate-700 rounded-lg p-2 text-sm flex gap-2">
          <button
            onClick={() => setDisplayMode("detailed")}
            className={`px-3 py-2 rounded transition ${displayMode === "detailed" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"}`}
          >
            عرض مفصل
          </button>
          <button
            onClick={() => setDisplayMode("simplified")}
            className={`px-3 py-2 rounded transition ${displayMode === "simplified" ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"}`}
          >
            عرض مبسّط
          </button>
        </div>

        <div className="absolute bottom-4 right-4 bg-slate-800/95 border border-slate-700 rounded-lg p-3 md:p-4 text-sm max-w-60">
          <h4 className="text-white font-semibold mb-3">المفتاح</h4>
          <div className="space-y-2 text-slate-300">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>علاقة أب/أم</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>خط الأبناء عبر bus line</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded"></div>
              <span>أخ/أخت</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-fuchsia-500 rounded"></div>
              <span>علاقة زواج</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            العرض المبسّط يخفي سياق الآباء والإخوة لتقليل التشابك في الأشجار الكثيفة.
          </p>
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
