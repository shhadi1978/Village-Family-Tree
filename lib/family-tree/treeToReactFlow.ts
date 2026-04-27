import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type {
  FamilyTreeMarriageGroup,
  FamilyTreeNode,
  MemberWithRelationships,
} from "../tree-logic";

const MEMBER_NODE_WIDTH = 200;
const MEMBER_NODE_HEIGHT = 100;
const MARRIAGE_NODE_WIDTH = 44;
const MARRIAGE_NODE_HEIGHT = 44;

type MemberNodeData = {
  member: MemberWithRelationships;
  isHighlighted: boolean;
};

type MarriageNodeData = {
  marriageId: string;
};

type QueueItem = {
  node: FamilyTreeNode;
  directParentId?: string;
};

function getMarriageNodeId(marriageId: string): string {
  return `marriage-${marriageId}`;
}

function sortChildrenByBirthDate(children: FamilyTreeNode[]): FamilyTreeNode[] {
  return [...children].sort((a, b) => {
    const dateA = a.member.dateOfBirth;
    const dateB = b.member.dateOfBirth;

    // Both have dates: sort oldest first (will be displayed RTL = oldest on right)
    if (dateA && dateB) {
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    }
    // No date: put at end
    if (!dateA && dateB) return 1;
    if (dateA && !dateB) return -1;
    return 0;
  });
}

export function convertTreeToFlow(rootNode: FamilyTreeNode): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const visitedMemberIds = new Set<string>();
  const visitedMarriageIds = new Set<string>();
  const edgeIds = new Set<string>();

  const queue: QueueItem[] = [{ node: rootNode }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const { node: currentNode, directParentId } = current;
    const memberId = currentNode.member.id;

    // RULE 5: Skip if already visited (BFS with visited tracking)
    if (visitedMemberIds.has(memberId)) {
      continue;
    }
    visitedMemberIds.add(memberId);

    // Create member node
    const memberFlowNode: Node<MemberNodeData> = {
      id: memberId,
      type: "memberNode",
      position: { x: 0, y: 0 },
      data: {
        member: currentNode.member,
        isHighlighted: false,
      },
      width: MEMBER_NODE_WIDTH,
      height: MEMBER_NODE_HEIGHT,
    };
    nodes.push(memberFlowNode);

    // Create edge from direct parent (if exists)
    if (directParentId) {
      const edgeId = `direct-${directParentId}-${memberId}`;
      if (!edgeIds.has(edgeId)) {
        edges.push({
          id: edgeId,
          source: directParentId,
          target: memberId,
          sourceHandle: "bottom",
          type: "smoothstep",
          style: { stroke: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "5,5" },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color: "#94a3b8",
          },
          animated: false,
        });
        edgeIds.add(edgeId);
      }
    }

    // Process marriages
    currentNode.marriages.forEach((marriageGroup: FamilyTreeMarriageGroup) => {
      const marriageNodeId = getMarriageNodeId(marriageGroup.marriageId);

      // Create marriage node (only once per marriage)
      if (!visitedMarriageIds.has(marriageGroup.marriageId)) {
        const marriageFlowNode: Node<MarriageNodeData> = {
          id: marriageNodeId,
          type: "marriageNode",
          position: { x: 0, y: 0 },
          data: { marriageId: marriageGroup.marriageId },
          width: MARRIAGE_NODE_WIDTH,
          height: MARRIAGE_NODE_HEIGHT,
        };
        nodes.push(marriageFlowNode);
        visitedMarriageIds.add(marriageGroup.marriageId);
      }

      // RULE 1: Create spouse -> marriage edge (straight, horizontal)
      const memberToMarriageEdgeId = `spouse-edge-${memberId}-${marriageGroup.marriageId}`;
      if (!edgeIds.has(memberToMarriageEdgeId)) {
        edges.push({
          id: memberToMarriageEdgeId,
          source: memberId,
          target: marriageNodeId,
          type: "straight",
          style: {
            stroke: "#f43f5e",
            strokeWidth: 2,
          },
          animated: false,
        });
        edgeIds.add(memberToMarriageEdgeId);
      }

      // Process spouse
      if (marriageGroup.spouse) {
        const spouseNode = marriageGroup.spouse;
        const spouseId = spouseNode.member.id;

        // RULE 1: Create spouse -> marriage edge (straight, horizontal)
        const spouseToMarriageEdgeId = `spouse-edge-${spouseId}-${marriageGroup.marriageId}`;
        if (!edgeIds.has(spouseToMarriageEdgeId)) {
          edges.push({
            id: spouseToMarriageEdgeId,
            source: spouseId,
            target: marriageNodeId,
            type: "straight",
            style: {
              stroke: "#f43f5e",
              strokeWidth: 2,
            },
            animated: false,
          });
          edgeIds.add(spouseToMarriageEdgeId);
        }

        // Queue spouse for processing (RULE 5: BFS)
        if (!visitedMemberIds.has(spouseId)) {
          queue.push({ node: spouseNode });
        }
      }

      // RULE 2 & RULE 4: Process children with marriage parent
      // Sort children by birth date ascending (oldest first)
      const sortedChildren = sortChildrenByBirthDate(marriageGroup.children);
      sortedChildren.forEach((childNode) => {
        const childId = childNode.member.id;

        // RULE 2: Create marriage -> child edge (smoothstep, vertical)
        const marriageToChildEdgeId = `child-edge-${marriageGroup.marriageId}-${childId}`;
        if (!edgeIds.has(marriageToChildEdgeId)) {
          edges.push({
            id: marriageToChildEdgeId,
            source: marriageNodeId,
            target: childId,
            sourceHandle: "bottom",
            type: "smoothstep",
            style: {
              stroke: "#64748b",
              strokeWidth: 1.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 12,
              height: 12,
              color: "#64748b",
            },
            animated: false,
          });
          edgeIds.add(marriageToChildEdgeId);
        }

        // Queue child for processing (RULE 5: BFS)
        if (!visitedMemberIds.has(childId)) {
          queue.push({ node: childNode });
        }
      });
    });

    // RULE 2 & RULE 4: Handle direct children (no marriage parent)
    // Sort children by birth date ascending (oldest first)
    const sortedDirectChildren = sortChildrenByBirthDate(currentNode.children);
    sortedDirectChildren.forEach((childNode) => {
      const childId = childNode.member.id;

      // Check if this child is already connected through a marriage
      const connectedViaMarriage = currentNode.marriages.some((mg) =>
        mg.children.some((ch) => ch.member.id === childId)
      );

      // Only create direct edge if not already connected via marriage
      if (!connectedViaMarriage) {
        // RULE 2: Create parent -> child edge (smoothstep, vertical)
        const directChildEdgeId = `direct-child-${memberId}-${childId}`;
        if (!edgeIds.has(directChildEdgeId)) {
          edges.push({
            id: directChildEdgeId,
            source: memberId,
            target: childId,
            sourceHandle: "bottom",
            type: "smoothstep",
            style: {
              stroke: "#64748b",
              strokeWidth: 1.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 12,
              height: 12,
              color: "#64748b",
            },
            animated: false,
          });
          edgeIds.add(directChildEdgeId);
        }
      }

      // Queue child for processing (RULE 5: BFS)
      if (!visitedMemberIds.has(childId)) {
        queue.push({ node: childNode });
      }
    });

    // RULE 5: Continue BFS traversal through parents and spouses
    currentNode.parents.forEach((parentNode) => {
      if (!visitedMemberIds.has(parentNode.member.id)) {
        queue.push({ node: parentNode });
      }
    });

    currentNode.spouses.forEach((spouseNode) => {
      if (!visitedMemberIds.has(spouseNode.member.id)) {
        queue.push({ node: spouseNode });
      }
    });
  }

  return { nodes, edges };
}

export function validateTreeData(nodes: Node[], edges: Edge[]): void {
  const nodeIds = new Set(nodes.map(n => n.id))
  
  // Check for orphan nodes
  const connectedNodes = new Set<string>()
  edges.forEach(e => {
    connectedNodes.add(e.source)
    connectedNodes.add(e.target)
  })
  
  const orphans = nodes.filter(n => !connectedNodes.has(n.id))
  if (orphans.length > 0) {
    console.warn('⚠️ Orphan nodes (no edges):', orphans.map(n => n.id))
  }
  
  // Check for invalid edges
  const invalidEdges = edges.filter(
    e => !nodeIds.has(e.source) || !nodeIds.has(e.target)
  )
  if (invalidEdges.length > 0) {
    console.error('❌ Invalid edges (missing nodes):', invalidEdges)
  }
  
  // Summary
  const memberNodes = nodes.filter(n => n.type === 'memberNode').length
  const marriageNodes = nodes.filter(n => n.type === 'marriageNode').length
  console.log(`✅ Tree: ${memberNodes} members, ${marriageNodes} marriages, ${edges.length} edges`)
  console.log(`✅ Orphans: ${orphans.length}, Invalid edges: ${invalidEdges.length}`)
}

export default convertTreeToFlow;
