"use client";

import { useCallback, useEffect, useState } from "react";
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
  Panel,
  Position,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import MemberNode from "./nodes/MemberNode";
import NexusNode from "./nodes/NexusNode";

const nodeTypes = {
  member: MemberNode,
  nexus: NexusNode,
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

// ─── Layout constants ──────────────────────────────────────────────────
const MEMBER_NODE_WIDTH = 256;  // Updated from 192 to accommodate w-64
const MEMBER_NODE_HEIGHT = 215;
const NEXUS_NODE_WIDTH = 12;
const NEXUS_NODE_HEIGHT = 12;
const HORIZONTAL_GAP = 320;  // Increased for better spacing with larger nodes
const VERTICAL_GAP = 220;
const MARRIAGE_CHILD_ANCHOR_Y_OFFSET = 62;
const CHILD_JUNCTION_Y_OFFSET = 94;
const CHILD_CLUSTER_GAP_DESKTOP = 240;
const CHILD_CLUSTER_GAP_MOBILE = 168;

/**
 * Apply Dagre hierarchical layout to all nodes and edges.
 * Adapts layout direction and spacing based on screen size.
 */
function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options: {
    isMobile: boolean;
    isPortrait: boolean;
    isNarrowMobile: boolean;
  }
): Node[] {
  if (nodes.length === 0) return nodes;

  const { isMobile, isPortrait, isNarrowMobile } = options;

  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    nodesep: isMobile ? (isNarrowMobile ? 80 : isPortrait ? 94 : 110) : 130,
    ranksep: 150,
    marginx: 60,
    marginy: 70,
  });

  const getNodeSize = (nodeType?: string) => {
    if (nodeType === "nexus") {
      return { width: NEXUS_NODE_WIDTH, height: NEXUS_NODE_HEIGHT };
    }

    if (isMobile) {
      return isNarrowMobile
        ? { width: 152, height: 154 }
        : { width: 176, height: 170 };
    }

    return { width: MEMBER_NODE_WIDTH, height: MEMBER_NODE_HEIGHT };
  };

  for (const node of nodes) {
    const { width, height } = getNodeSize(node.type);
    graph.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    const isNexusSpouseEdge = edge.id.includes("__to__nexus__");
    const isChildEdge = edge.id.includes("-child");
    const isSiblingEdge = edge.id.includes("-sibling");

    let weight = 1;
    let minlen = 1;

    if (isNexusSpouseEdge) {
      // Keep nexus on same rank as spouses.
      weight = 3;
      minlen = 0;
    } else if (isChildEdge) {
      weight = 2;
      minlen = 1;
    } else if (isSiblingEdge) {
      weight = 1;
      minlen = 0;
    }

    graph.setEdge(edge.source, edge.target, { weight, minlen });
  }

  try {
    dagre.layout(graph);
  } catch (error) {
    console.error("Dagre layout failed, using raw positions as fallback:", error);
    return nodes;
  }

  const positionedNodes = nodes.map((node) => {
    const pos = graph.node(node.id);
    if (!pos) return node;

    const { width: w, height: h } = getNodeSize(node.type);

    return {
      ...node,
      position: {
        x: pos.x - w / 2,
        y: pos.y - h / 2,
      },
    };
  });

  // Force each nexus to stay at the midpoint between spouses.
  const nodeById = new Map(positionedNodes.map((node) => [node.id, node]));
  const spouseEdgesToNexus = edges.filter((edge) => edge.id.includes("__to__nexus__"));
  const spouseSourcesByNexus = new Map<string, string[]>();

  spouseEdgesToNexus.forEach((edge) => {
    const sources = spouseSourcesByNexus.get(edge.target) || [];
    sources.push(edge.source);
    spouseSourcesByNexus.set(edge.target, sources);
  });

  positionedNodes.forEach((node) => {
    if (node.type !== "nexus") {
      return;
    }

    const spouses = spouseSourcesByNexus.get(node.id) || [];
    if (spouses.length < 2) {
      return;
    }

    const spouseA = nodeById.get(spouses[0]);
    const spouseB = nodeById.get(spouses[1]);
    if (!spouseA || !spouseB) {
      return;
    }

    const { width: aWidth, height: aHeight } = getNodeSize(spouseA.type);
    const { width: bWidth, height: bHeight } = getNodeSize(spouseB.type);
    const { width: nWidth, height: nHeight } = getNodeSize(node.type);

    const centerAX = spouseA.position.x + aWidth / 2;
    const centerBX = spouseB.position.x + bWidth / 2;
    const centerAY = spouseA.position.y + aHeight / 2;
    const centerBY = spouseB.position.y + bHeight / 2;

    node.position = {
      x: (centerAX + centerBX) / 2 - nWidth / 2,
      y: (centerAY + centerBY) / 2 + 8 - nHeight / 2,
    };
  });

  // Clamp spouse pair span to avoid very long dashed marriage links in dense trees.
  const maxSpouseSpan = isMobile ? (isNarrowMobile ? 220 : 280) : 360;

  positionedNodes.forEach((node) => {
    if (node.type !== "nexus") {
      return;
    }

    const spouses = spouseSourcesByNexus.get(node.id) || [];
    if (spouses.length < 2) {
      return;
    }

    const spouseA = nodeById.get(spouses[0]);
    const spouseB = nodeById.get(spouses[1]);
    if (!spouseA || !spouseB) {
      return;
    }

    const { width: aWidth, height: aHeight } = getNodeSize(spouseA.type);
    const { width: bWidth, height: bHeight } = getNodeSize(spouseB.type);
    const { width: nWidth, height: nHeight } = getNodeSize(node.type);

    const centerAX = spouseA.position.x + aWidth / 2;
    const centerBX = spouseB.position.x + bWidth / 2;
    const centerAY = spouseA.position.y + aHeight / 2;
    const centerBY = spouseB.position.y + bHeight / 2;
    const span = Math.abs(centerBX - centerAX);

    if (span > maxSpouseSpan) {
      const midX = (centerAX + centerBX) / 2;
      const targetAX = midX - maxSpouseSpan / 2;
      const targetBX = midX + maxSpouseSpan / 2;
      const shiftAX = targetAX - centerAX;
      const shiftBX = targetBX - centerBX;
      const rowCenterY = (centerAY + centerBY) / 2;

      spouseA.position = {
        x: spouseA.position.x + shiftAX,
        y: rowCenterY - aHeight / 2,
      };
      spouseB.position = {
        x: spouseB.position.x + shiftBX,
        y: rowCenterY - bHeight / 2,
      };
    }

    const nextCenterAX = spouseA.position.x + aWidth / 2;
    const nextCenterBX = spouseB.position.x + bWidth / 2;
    const nextCenterAY = spouseA.position.y + aHeight / 2;
    const nextCenterBY = spouseB.position.y + bHeight / 2;

    node.position = {
      x: (nextCenterAX + nextCenterBX) / 2 - nWidth / 2,
      y: (nextCenterAY + nextCenterBY) / 2 + 8 - nHeight / 2,
    };
  });

  return positionedNodes;
}

/**
 * Keep manual tree layout compact and visually balanced:
 * - Pack nodes on the same row to reduce excessive sibling spread.
 * - Keep each marriage nexus centered between spouses.
 */
function applyManualLayoutPolish(
  nodes: Node[],
  edges: Edge[],
  options: { isMobile: boolean; isNarrowMobile: boolean }
): Node[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const { isMobile, isNarrowMobile } = options;
  const polished = nodes.map((node) => ({
    ...node,
    position: { ...node.position },
  }));

  // 1) Compact member rows while preserving each row center.
  const rowBucketSize = isMobile ? 34 : 40;
  const minGap = isMobile ? (isNarrowMobile ? 136 : 154) : 214;
  const rows = new Map<number, Node[]>();

  polished.forEach((node) => {
    if (node.type !== "member") {
      return;
    }

    const rowKey = Math.round(node.position.y / rowBucketSize);
    const row = rows.get(rowKey) || [];
    row.push(node);
    rows.set(rowKey, row);
  });

  rows.forEach((rowNodes) => {
    if (rowNodes.length <= 1) {
      return;
    }

    rowNodes.sort((a, b) => a.position.x - b.position.x);
    const originalCenter =
      (rowNodes[0].position.x + rowNodes[rowNodes.length - 1].position.x) / 2;

    for (let i = 1; i < rowNodes.length; i += 1) {
      const previous = rowNodes[i - 1];
      const current = rowNodes[i];
      const nextMinX = previous.position.x + minGap;
      if (current.position.x < nextMinX) {
        current.position.x = nextMinX;
      }
    }

    const packedCenter =
      (rowNodes[0].position.x + rowNodes[rowNodes.length - 1].position.x) / 2;
    const centerShift = originalCenter - packedCenter;
    rowNodes.forEach((node) => {
      node.position.x += centerShift;
    });
  });

  // 2) Re-center each marriage nexus between its spouses and clamp span.
  const nodeById = new Map(polished.map((node) => [node.id, node]));
  const spouseEdgesToNexus = edges.filter((edge) => edge.id.includes("__to__nexus__"));
  const spouseSourcesByNexus = new Map<string, string[]>();

  spouseEdgesToNexus.forEach((edge) => {
    const sources = spouseSourcesByNexus.get(edge.target) || [];
    sources.push(edge.source);
    spouseSourcesByNexus.set(edge.target, sources);
  });

  const maxSpouseSpan = isMobile ? (isNarrowMobile ? 220 : 280) : 360;

  polished.forEach((node) => {
    if (node.type !== "nexus") {
      return;
    }

    const spouses = spouseSourcesByNexus.get(node.id) || [];
    if (spouses.length < 2) {
      return;
    }

    const spouseA = nodeById.get(spouses[0]);
    const spouseB = nodeById.get(spouses[1]);
    if (!spouseA || !spouseB) {
      return;
    }

    const centerAX = spouseA.position.x + MEMBER_NODE_WIDTH / 2;
    const centerBX = spouseB.position.x + MEMBER_NODE_WIDTH / 2;
    const centerAY = spouseA.position.y + MEMBER_NODE_HEIGHT / 2;
    const centerBY = spouseB.position.y + MEMBER_NODE_HEIGHT / 2;
    const span = Math.abs(centerBX - centerAX);

    if (span > maxSpouseSpan) {
      const midX = (centerAX + centerBX) / 2;
      const targetAX = midX - maxSpouseSpan / 2;
      const targetBX = midX + maxSpouseSpan / 2;
      spouseA.position.x += targetAX - centerAX;
      spouseB.position.x += targetBX - centerBX;
    }

    const nextCenterAX = spouseA.position.x + MEMBER_NODE_WIDTH / 2;
    const nextCenterBX = spouseB.position.x + MEMBER_NODE_WIDTH / 2;
    const nextCenterAY = spouseA.position.y + MEMBER_NODE_HEIGHT / 2;
    const nextCenterBY = spouseB.position.y + MEMBER_NODE_HEIGHT / 2;

    node.position = {
      x: (nextCenterAX + nextCenterBX) / 2 - NEXUS_NODE_WIDTH / 2,
      y: (nextCenterAY + nextCenterBY) / 2 + 8 - NEXUS_NODE_HEIGHT / 2,
    };
  });

  return polished;
}

function getNexusNodeId(memberId: string, spouseId: string) {
  return [memberId, spouseId].sort().join("__nexus__");
}


function compareTreeNodes(a: TreeNodeUI, b: TreeNodeUI) {
  // RTL chronological order: older members appear more to the right.
  const timeA = a.member.dateOfBirth ? new Date(a.member.dateOfBirth).getTime() : Number.NEGATIVE_INFINITY;
  const timeB = b.member.dateOfBirth ? new Date(b.member.dateOfBirth).getTime() : Number.NEGATIVE_INFINITY;

  if (timeA !== timeB) {
    return timeB - timeA;
  }

  return String(b.member.fullName || "").localeCompare(String(a.member.fullName || ""), "ar");
}

function compareChildrenForRtlByBirth(a: TreeNodeUI, b: TreeNodeUI) {
  // Desired visual order in RTL: older at the right side.
  // Since coordinates grow left->right, place younger first.
  const timeA = a.member.dateOfBirth
    ? new Date(a.member.dateOfBirth).getTime()
    : Number.NEGATIVE_INFINITY;
  const timeB = b.member.dateOfBirth
    ? new Date(b.member.dateOfBirth).getTime()
    : Number.NEGATIVE_INFINITY;

  if (timeA !== timeB) {
    return timeA - timeB;
  }

  return String(a.member.fullName || "").localeCompare(String(b.member.fullName || ""), "ar");
}

function uniqueByMemberId(items: TreeNodeUI[]) {
  const seen = new Set<string>();
  const unique: TreeNodeUI[] = [];

  items.forEach((item) => {
    const id = item.member.id;
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    unique.push(item);
  });

  return unique;
}

function hasDescendants(node: TreeNodeUI) {
  return node.children.length > 0 || node.marriages.some((marriage) => marriage.children.length > 0);
}

function countBranchUnits(node: TreeNodeUI, collapsedMemberIds: Set<string>): number {
  const allChildren = [
    ...node.children,
    ...node.marriages.flatMap((marriage) => marriage.children),
  ];

  if (allChildren.length === 0 || collapsedMemberIds.has(node.member.id)) {
    return 1;
  }

  return [...allChildren].sort(compareTreeNodes).reduce((total, child) => {
    return total + countBranchUnits(child, collapsedMemberIds);
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
    Math.max(0, marriageCount - 1) * 120 +
    Math.max(0, densityBoost - 2) * 30
  );
}

function getChildSourceHandle(childIndex: number, totalChildren: number) {
  if (totalChildren <= 1) {
    return "source-bottom";
  }

  const ratio = childIndex / (totalChildren - 1);

  if (ratio < 0.2) {
    return "source-bottom-far-left";
  }

  if (ratio < 0.4) {
    return "source-bottom-left";
  }

  if (ratio < 0.6) {
    return "source-bottom-center";
  }

  if (ratio < 0.8) {
    return "source-bottom-right";
  }

  return "source-bottom-far-right";
}

function getChildTargetHandle(childIndex: number, totalChildren: number) {
  if (totalChildren <= 1) {
    return "target-top";
  }

  const ratio = childIndex / (totalChildren - 1);

  if (ratio < 0.2) {
    return "target-top-far-left";
  }

  if (ratio < 0.4) {
    return "target-top-left";
  }

  if (ratio < 0.6) {
    return "target-top-center";
  }

  if (ratio < 0.8) {
    return "target-top-right";
  }

  return "target-top-far-right";
}

function getChildEdgeOverrides(childIndex: number, totalChildren: number): Partial<Edge> {
  if (totalChildren <= 1) {
    return {
      type: "smoothstep",
      pathOptions: {
        offset: 22,
        borderRadius: 16,
      },
    };
  }

  const middle = (totalChildren - 1) / 2;
  const distanceFromMiddle = Math.abs(childIndex - middle);

  return {
    type: "smoothstep",
    pathOptions: {
      // Increase offset for outer children so lines fan out and overlap less.
      offset: 22 + distanceFromMiddle * 14,
      borderRadius: 16 + distanceFromMiddle * 6,
    },
    style: {
      strokeWidth: 2,
      opacity: 0.95,
    },
  };
}

function getChildClusterGap(isMobile: boolean) {
  return isMobile ? CHILD_CLUSTER_GAP_MOBILE : CHILD_CLUSTER_GAP_DESKTOP;
}

function buildEdge(
  id: string,
  source: string,
  target: string,
  relation: "parent" | "child" | "sibling" | "spouse",
  sourceHandle?: string,
  targetHandle?: string,
  overrides?: Partial<Edge>
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
    type: overrides?.type || "smoothstep",
    animated: false,
    sourceHandle,
    targetHandle,
    style: {
      ...styles[relation],
      ...(overrides?.style || {}),
    },
    zIndex: overrides?.zIndex,
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
  collapsedMemberIds: Set<string> = new Set(),
  onToggleCollapse?: (memberId: string) => void,
  isMobile = false,
  isCompactMobile = false,
  showExtendedMobile = false
) {
  const nodeMap = new Map<string, Node>();
  const edgeMap = new Map<string, Edge>();
  const processedMembers = new Set<string>();
  const focusDescendantsOnly = isMobile && !showExtendedMobile;

  function ensureNode(treeNode: TreeNodeUI, x = 0, y = 0) {
    const memberId = treeNode.member.id;

    const existing = nodeMap.get(memberId);
    if (existing) {
      return;
    }

    nodeMap.set(memberId, {
      id: memberId,
      data: {
        member: treeNode.member,
        familyName,
        onRefresh,
        isMobile,
        isCompactMobile,
        isCollapsed: collapsedMemberIds.has(memberId),
        hasDescendants: hasDescendants(treeNode),
        onToggleCollapse,
      },
      position: { x, y },
      type: "member",
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: true,
    });
  }

  function ensureEdge(edge: Edge) {
    if (!edgeMap.has(edge.id)) {
      edgeMap.set(edge.id, edge);
    }
  }

  function ensureNexusNode(id: string, x: number, y: number) {
    const existing = nodeMap.get(id);
    if (existing) {
      return;
    }

    nodeMap.set(id, {
      id,
      data: {},
      position: { x, y },
      type: "nexus",
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
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
      const nexusX = memberX + (index + 0.5) * localHorizontalGap;
      const nexusY = memberY + MARRIAGE_CHILD_ANCHOR_Y_OFFSET;
      const nexusNodeId = spouse
        ? getNexusNodeId(treeNode.member.id, spouse.member.id)
        : `${treeNode.member.id}__nexus__${marriage.marriageId}`;

      if (spouse) {
        ensureNode(spouse, spouseX, memberY);
      }

      ensureNexusNode(nexusNodeId, nexusX, nexusY);

      // Y-connection arm 1: husband -> nexus
      ensureEdge(
        buildEdge(
          `${treeNode.member.id}__to__nexus__${nexusNodeId}`,
          treeNode.member.id,
          nexusNodeId,
          "spouse",
          "source-right",
          "target-left",
          {
            type: "smoothstep",
            zIndex: 5,
            style: { strokeWidth: 2.4, strokeDasharray: "9 4" },
          }
        )
      );

      if (spouse) {
        // Y-connection arm 2: wife -> nexus
        ensureEdge(
          buildEdge(
            `${spouse.member.id}__to__nexus__${nexusNodeId}`,
            spouse.member.id,
            nexusNodeId,
            "spouse",
            "source-left",
            "target-right",
            {
              type: "smoothstep",
              zIndex: 5,
              style: { strokeWidth: 2.4, strokeDasharray: "9 4" },
            }
          )
        );
      }

      return {
        marriageId: marriage.marriageId,
        marriageNodeId: nexusNodeId,
        anchorX: nexusX,
        children: uniqueByMemberId([...marriage.children]).sort(compareChildrenForRtlByBirth),
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
      sectionId: string;
      sourceId: string;
      anchorX: number;
      children: TreeNodeUI[];
    }> = [];

    const marriageChildrenIds = new Set(
      spouseLayout.marriageLayouts.flatMap((layout) => layout.children.map((child) => child.member.id))
    );

    // Keep only children that are not already attached to a marriage nexus.
    const directChildren = uniqueByMemberId([...treeNode.children])
      .filter((child) => !marriageChildrenIds.has(child.member.id))
      .sort(compareChildrenForRtlByBirth);

    if (directChildren.length > 0) {
      sections.push({
        sectionId: `${treeNode.member.id}__children__direct`,
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
        sectionId: `${layout.marriageNodeId}__children`,
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

    if (childSections.length === 0 || collapsedMemberIds.has(memberId)) {
      return;
    }

    childSections.forEach((section) => {
      const childY = levelY + VERTICAL_GAP;
      const clusterGap = Math.min(localHorizontalGap, getChildClusterGap(isMobile));
      const junctionId = `${section.sectionId}__junction__${memberId}`;

      if (section.children.length > 1) {
        ensureNexusNode(junctionId, section.anchorX, levelY + CHILD_JUNCTION_Y_OFFSET);
        ensureEdge(
          buildEdge(
            `${section.sourceId}__to__${junctionId}__junction`,
            section.sourceId,
            junctionId,
            "child",
            "source-bottom-center",
            "target-top",
            {
              type: "smoothstep",
              pathOptions: { offset: 18, borderRadius: 14 },
            }
          )
        );
      }

      let cursorX = section.anchorX - ((section.children.length - 1) * clusterGap) / 2;

      section.children.forEach((child, childIndex) => {
        const childCenterX = cursorX;

        placeDescendants(child, childCenterX, childY);
        ensureEdge(
          buildEdge(
            `${section.sourceId}-${child.member.id}-child`,
            section.children.length > 1 ? junctionId : section.sourceId,
            child.member.id,
            "child",
            getChildSourceHandle(childIndex, section.children.length),
            getChildTargetHandle(childIndex, section.children.length),
            getChildEdgeOverrides(childIndex, section.children.length)
          )
        );

        cursorX += clusterGap;
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

    let siblingsCount = 0;
    if (!focusDescendantsOnly) {
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
      siblingsCount = sortedSiblings.length;
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
    }

    if (collapsedMemberIds.has(treeNode.member.id)) {
      return;
    }

    const descendantsStartY = siblingsCount > 0 ? rootY + VERTICAL_GAP * 2 : rootY + VERTICAL_GAP;
    childSections.forEach((section) => {
      const clusterGap = Math.min(localHorizontalGap, getChildClusterGap(isMobile));
      const junctionId = `${section.sectionId}__junction__root`;

      if (section.children.length > 1) {
        ensureNexusNode(junctionId, section.anchorX, rootY + CHILD_JUNCTION_Y_OFFSET);
        ensureEdge(
          buildEdge(
            `${section.sourceId}__to__${junctionId}__junction__root`,
            section.sourceId,
            junctionId,
            "child",
            "source-bottom-center",
            "target-top",
            {
              type: "smoothstep",
              pathOptions: { offset: 18, borderRadius: 14 },
            }
          )
        );
      }

      let cursorX = section.anchorX - ((section.children.length - 1) * clusterGap) / 2;

      section.children.forEach((child, childIndex) => {
        const childCenterX = cursorX;
        placeDescendants(child, childCenterX, descendantsStartY);
        ensureEdge(
          buildEdge(
            `${section.sourceId}-${child.member.id}-child-root`,
            section.children.length > 1 ? junctionId : section.sourceId,
            child.member.id,
            "child",
            getChildSourceHandle(childIndex, section.children.length),
            getChildTargetHandle(childIndex, section.children.length),
            getChildEdgeOverrides(childIndex, section.children.length)
          )
        );
        cursorX += clusterGap;
      });
    });
  }

  if (node) {
    placeFocusedTree(node);
  }

  const rawNodes = Array.from(nodeMap.values());
  const rawEdges = Array.from(edgeMap.values());

  return { nodes: rawNodes, edges: rawEdges };
}

function FamilyTreeFlowCanvas({
  treeData,
  loading = false,
  familyName,
  onRefresh,
}: FamilyTreeVisualizationProps) {
  const [collapsedMemberIds, setCollapsedMemberIds] = useState<Set<string>>(new Set());
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isNarrowMobile, setIsNarrowMobile] = useState(false);
  const [showExtendedMobile, setShowExtendedMobile] = useState(false);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // Monitor viewport + orientation with matchMedia for reliable mobile rotation updates
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const widthQuery = window.matchMedia("(max-width: 767px)");
    const narrowWidthQuery = window.matchMedia("(max-width: 430px)");
    const orientationQuery = window.matchMedia("(orientation: portrait)");

    const syncLayoutMode = () => {
      setIsMobile(widthQuery.matches);
      setIsNarrowMobile(narrowWidthQuery.matches);
      setIsPortrait(orientationQuery.matches);
    };

    syncLayoutMode();
    widthQuery.addEventListener("change", syncLayoutMode);
    narrowWidthQuery.addEventListener("change", syncLayoutMode);
    orientationQuery.addEventListener("change", syncLayoutMode);

    return () => {
      widthQuery.removeEventListener("change", syncLayoutMode);
      narrowWidthQuery.removeEventListener("change", syncLayoutMode);
      orientationQuery.removeEventListener("change", syncLayoutMode);
    };
  }, []);

  const handleFitView = useCallback(() => {
    const padding = isMobile ? (isNarrowMobile ? 0.34 : 0.26) : 0.15;
    fitView({ padding, duration: 300 });
  }, [fitView, isMobile, isNarrowMobile]);

  const handleToggleCollapse = (memberId: string) => {
    setCollapsedMemberIds((previous) => {
      const next = new Set(previous);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleToggleMobileDetailMode = () => {
    setShowExtendedMobile((previous) => !previous);
  };

  useEffect(() => {
    if (treeData && !loading) {
      const { nodes: rawNodes, edges: rawEdges } = convertTreeToGraph(
        treeData,
        familyName,
        onRefresh,
        collapsedMemberIds,
        handleToggleCollapse,
        isMobile,
        isNarrowMobile,
        showExtendedMobile
      );

      // Use dagre for stable non-overlapping placement.
      const newNodes = applyDagreLayout(rawNodes, rawEdges, {
        isMobile,
        isPortrait,
        isNarrowMobile,
      });

      setNodes(newNodes);
      setEdges(rawEdges);
      const padding = isMobile ? (isNarrowMobile ? 0.34 : 0.26) : 0.15;
      setTimeout(() => fitView({ padding }), 120);
    }
  }, [
    treeData,
    loading,
    familyName,
    onRefresh,
    collapsedMemberIds,
    isMobile,
    isPortrait,
    isNarrowMobile,
    showExtendedMobile,
    setNodes,
    setEdges,
    fitView,
  ]);

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
        panOnScroll
        panOnDrag
        zoomOnPinch
        selectionOnDrag={false}
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
          zIndex: 1,
        }}
      >
        <Background color="#334155" gap={16} />

        {/* Hide default controls on mobile — we have our own panel */}
        {!isMobile && <Controls />}
        {!isMobile && (
          <MiniMap
            nodeColor={() => "#6366f1"}
            nodeStrokeColor={() => "#1e293b"}
            nodeBorderRadius={8}
            maskColor="rgba(0, 0, 0, 0.5)"
          />
        )}

        {/* Legend — hidden on mobile to save space */}
        {!isMobile && (
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
        )}

        {/* Floating control panel — always visible, critical for mobile */}
        <Panel position="bottom-center">
          <div className="flex items-center gap-2 bg-slate-800/95 border border-slate-700 rounded-full px-4 py-2 shadow-xl backdrop-blur-sm mb-3">
            <button
              onClick={() => zoomIn({ duration: 200 })}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 text-white text-xl font-bold transition"
              title="تكبير"
            >
              +
            </button>
            <button
              onClick={handleFitView}
              className="px-3 h-9 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
              title="ملاءمة الشاشة"
            >
              ملاءمة
            </button>
            <button
              onClick={() => zoomOut({ duration: 200 })}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 text-white text-xl font-bold transition"
              title="تصغير"
            >
              −
            </button>
            {isMobile && (
              <button
                onClick={handleToggleMobileDetailMode}
                className={`px-3 h-9 flex items-center justify-center rounded-full text-xs font-semibold transition ${
                  showExtendedMobile
                    ? "bg-amber-600 hover:bg-amber-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
                title={showExtendedMobile ? "العرض الكامل مفعل" : "العرض المبسط مفعل"}
              >
                {showExtendedMobile ? "عرض كامل" : "عرض مبسط"}
              </button>
            )}
          </div>
        </Panel>
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
