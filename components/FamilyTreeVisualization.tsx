'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  MarkerType,
  Panel,
  Position,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import MemberNode from './nodes/MemberNode';
import NexusNode from './nodes/NexusNode';
import MarriageNode from './nodes/MarriageNode';

const nodeTypes: NodeTypes = {
  member: MemberNode as NodeTypes[string],
  nexus: NexusNode as NodeTypes[string],
  union: MarriageNode as NodeTypes[string],
};

type TreeMemberUI = {
  id: string;
  fullName: string;
  nickname?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  isExternal?: boolean;
  externalOriginText?: string | null;
  externalNotes?: string | null;
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

type FamilyTreeVisualizationProps = {
  treeData: TreeNodeUI | null;
  loading?: boolean;
  familyName?: string;
  onRefresh?: () => void;
  focusDescendantsOnly?: boolean;
};

const MEMBER_NODE_WIDTH = 256;
const MEMBER_NODE_HEIGHT = 272;
const MOBILE_MEMBER_NODE_WIDTH = 176;
const MOBILE_MEMBER_NODE_HEIGHT = 236;
const COMPACT_MOBILE_MEMBER_NODE_WIDTH = 144;
const COMPACT_MOBILE_MEMBER_NODE_HEIGHT = 214;
const DENSE_TREE_NODE_THRESHOLD = 50;

const LAYOUT_MEMBER_NODE_WIDTH = 200;
const LAYOUT_MEMBER_NODE_HEIGHT = 80;
const LAYOUT_UNION_NODE_WIDTH = 16;
const LAYOUT_UNION_NODE_HEIGHT = 16;

function countTreeNodes(root: TreeNodeUI | null): number {
  if (!root) {
    return 0;
  }

  const visited = new Set<string>();
  const queue: TreeNodeUI[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const id = current.member.id;
    if (visited.has(id)) {
      continue;
    }

    visited.add(id);
    queue.push(...current.parents);
    queue.push(...current.siblings);
    queue.push(...current.children);
    queue.push(...current.spouses);
    queue.push(...current.marriages.flatMap((marriage) => marriage.children));

    current.marriages.forEach((marriage) => {
      if (marriage.spouse) {
        queue.push(marriage.spouse);
      }
    });
  }

  return visited.size;
}

type RawRelationship = {
  childId: string;
  parentIds: string[];
};

type SpouseLink = {
  leftId: string;
  rightId: string;
};

type TransformOptions = {
  familyName?: string;
  onRefresh?: () => void;
  isMobile?: boolean;
  isCompactMobile?: boolean;
  collapsedMemberIds?: Set<string>;
  onToggleCollapse?: (memberId: string) => void;
  onFocusMember?: (memberId: string) => void;
  spouses?: Set<string>;
  spouseLinks?: SpouseLink[];
  membersWithDescendants?: Set<string>;
};

type FlowEdge = Edge & {
  pathOptions?: {
    borderRadius?: number;
    offset?: number;
  };
  /** Dagre layout weight carried from the transformer */
  weight?: number;
};

function createMarkerArrow(color: string): Edge['markerEnd'] {
  return {
    type: MarkerType.ArrowClosed,
    color,
  };
}

function isUnionNodeId(nodeId: string): boolean {
  return nodeId.startsWith('union-');
}

function getNodeRenderSize(node: Node): { width: number; height: number } {
  const style = (node.style ?? {}) as { width?: number | string; height?: number | string; minHeight?: number | string };

  const widthFromStyle = typeof style.width === 'number' ? style.width : Number(style.width);
  const heightFromStyle = typeof style.height === 'number' ? style.height : Number(style.height);
  const minHeightFromStyle = typeof style.minHeight === 'number' ? style.minHeight : Number(style.minHeight);

  const width = Number.isFinite(widthFromStyle) ? widthFromStyle : MEMBER_NODE_WIDTH;
  const height = Number.isFinite(heightFromStyle)
    ? heightFromStyle
    : Number.isFinite(minHeightFromStyle)
      ? minHeightFromStyle
      : MEMBER_NODE_HEIGHT;

  return { width, height };
}

function getNodeLayoutSize(node: Node): { width: number; height: number } {
  if (isUnionNodeId(node.id)) {
    return { width: LAYOUT_UNION_NODE_WIDTH, height: LAYOUT_UNION_NODE_HEIGHT };
  }

  return { width: LAYOUT_MEMBER_NODE_WIDTH, height: LAYOUT_MEMBER_NODE_HEIGHT };
}

function parseDateOfBirth(value: TreeMemberUI['dateOfBirth']): number | null {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function compareMemberIdsForSiblingOrder(memberById: Map<string, TreeMemberUI>, aId: string, bId: string): number {
  const aBirth = parseDateOfBirth(memberById.get(aId)?.dateOfBirth ?? null);
  const bBirth = parseDateOfBirth(memberById.get(bId)?.dateOfBirth ?? null);

  if (aBirth !== null && bBirth !== null && aBirth !== bBirth) {
    return aBirth - bBirth;
  }

  if (aBirth !== null && bBirth === null) {
    return -1;
  }

  if (aBirth === null && bBirth !== null) {
    return 1;
  }

  return aId.localeCompare(bId);
}

function getLayoutedElements(inputNodes: Node[], inputEdges: FlowEdge[]) {
  // ─── Pedigree Layout Constants ────────────────────────────────────────────
  const SPOUSE_GAP = 50;   // horizontal gap between the two spouses
  const CHILD_GAP  = 120;  // horizontal gap between adjacent child subtrees
  const ROW_HEIGHT = 440;  // vertical distance between generations

  // ─── Build family graph ────────────────────────────────────────────────────
  const nodesById = new Map(inputNodes.map(n => [n.id, n]));
  const parentsByUnion  = new Map<string, string[]>(); // union ← parents
  const childrenByUnion = new Map<string, string[]>(); // union → children
  const parentUnionOf   = new Map<string, string>();   // member → union (as child)
  const ownUnionsOf     = new Map<string, string[]>(); // member → own unions (as parent)

  inputEdges.forEach(edge => {
    if (isUnionNodeId(edge.target) && !isUnionNodeId(edge.source)) {
      const arr = parentsByUnion.get(edge.target) ?? [];
      if (!arr.includes(edge.source)) arr.push(edge.source);
      parentsByUnion.set(edge.target, arr);
      const us = ownUnionsOf.get(edge.source) ?? [];
      if (!us.includes(edge.target)) us.push(edge.target);
      ownUnionsOf.set(edge.source, us);
    }
    if (isUnionNodeId(edge.source) && !isUnionNodeId(edge.target)) {
      const arr = childrenByUnion.get(edge.source) ?? [];
      if (!arr.includes(edge.target)) arr.push(edge.target);
      childrenByUnion.set(edge.source, arr);
      parentUnionOf.set(edge.target, edge.source);
    }
  });

  // Preserve input order for siblings, consistent left/right for couples
  const inputOrder = new Map(inputNodes.map((n, i) => [n.id, i]));
  childrenByUnion.forEach((ch, uid) =>
    childrenByUnion.set(uid, [...ch].sort((a, b) =>
      (inputOrder.get(a) ?? 0) - (inputOrder.get(b) ?? 0))));
  parentsByUnion.forEach((ps, uid) => {
    if (ps.length >= 2)
      parentsByUnion.set(uid, [...ps].sort((a, b) => a.localeCompare(b)));
  });

  const sizeOf = (id: string) => {
    const n = nodesById.get(id);
    if (!n) return { width: LAYOUT_MEMBER_NODE_WIDTH, height: LAYOUT_MEMBER_NODE_HEIGHT };
    return getNodeRenderSize(n);
  };

  // ─── Cross-branch unions: both parents are children in the tree ────────────
  // These are processed in a second pass so each branch independently claims leaf widths.
  const crossBranchUnions = new Set<string>();
  parentsByUnion.forEach((parents, uid) => {
    if (parents.length >= 2 && parents.every(pid => parentUnionOf.has(pid)))
      crossBranchUnions.add(uid);
  });

  // For width calc: exclude cross-branch union subtrees (treat those parents as leaves)
  const effectiveUnions = (id: string) =>
    (ownUnionsOf.get(id) ?? []).filter(uid => !crossBranchUnions.has(uid));

  // ─── Subtree width (bottom-up, memoised) ──────────────────────────────────
  const memberWidthCache = new Map<string, number>();
  const unionWidthCache  = new Map<string, number>();

  function memberSubtreeWidth(id: string): number {
    if (memberWidthCache.has(id)) return memberWidthCache.get(id)!;
    const unions = effectiveUnions(id);
    const w = unions.length > 0
      ? Math.max(...unions.map(uid => unionSubtreeWidth(uid)))
      : sizeOf(id).width;
    memberWidthCache.set(id, w);
    return w;
  }

  function unionSubtreeWidth(uid: string): number {
    if (unionWidthCache.has(uid)) return unionWidthCache.get(uid)!;
    const parents  = parentsByUnion.get(uid)  ?? [];
    const children = childrenByUnion.get(uid) ?? [];
    const coupleSpan = parents.length >= 2
      ? sizeOf(parents[0]).width + SPOUSE_GAP + sizeOf(parents[1]).width
      : parents.length === 1 ? sizeOf(parents[0]).width : 0;
    const childSpan = children.reduce((sum, cid, i) =>
      sum + memberSubtreeWidth(cid) + (i > 0 ? CHILD_GAP : 0), 0);
    const w = Math.max(coupleSpan, childSpan, LAYOUT_UNION_NODE_WIDTH);
    unionWidthCache.set(uid, w);
    return w;
  }

  // ─── Position assignment (top-down) ──────────────────────────────────────
  const positions     = new Map<string, { x: number; y: number }>();
  const visitedUnions = new Set<string>();

  function positionUnion(uid: string, centerX: number, generation: number): void {
    if (visitedUnions.has(uid) || crossBranchUnions.has(uid)) return;
    visitedUnions.add(uid);

    const parents  = parentsByUnion.get(uid)  ?? [];
    const children = childrenByUnion.get(uid) ?? [];
    const parentY  = generation * ROW_HEIGHT;
    const parentH  = parents.length > 0 ? sizeOf(parents[0]).height : LAYOUT_MEMBER_NODE_HEIGHT;
    const unionY   = parentY + (parentH - LAYOUT_UNION_NODE_HEIGHT) / 2;

    positions.set(uid, { x: centerX - LAYOUT_UNION_NODE_WIDTH / 2, y: unionY });

    if (parents.length >= 2) {
      const [lId, rId] = parents;
      const lW = sizeOf(lId).width;
      positions.set(lId, { x: centerX - SPOUSE_GAP / 2 - lW, y: parentY });
      positions.set(rId, { x: centerX + SPOUSE_GAP / 2,       y: parentY });
    } else if (parents.length === 1) {
      const lW = sizeOf(parents[0]).width;
      positions.set(parents[0], { x: centerX - lW / 2, y: parentY });
    }

    if (children.length > 0) {
      const childY    = (generation + 1) * ROW_HEIGHT;
      const totalSpan = children.reduce((sum, cid, i) =>
        sum + memberSubtreeWidth(cid) + (i > 0 ? CHILD_GAP : 0), 0);
      let cursorX = centerX - totalSpan / 2;

      children.forEach(childId => {
        const cw           = memberSubtreeWidth(childId);
        const childCenterX = cursorX + cw / 2;
        const childOwnNonCross = effectiveUnions(childId);

        if (childOwnNonCross.length > 0) {
          childOwnNonCross.forEach(cuid => positionUnion(cuid, childCenterX, generation + 1));
        } else {
          // Leaf node — position directly (may be overridden by cross-branch pass)
          const cs = sizeOf(childId);
          positions.set(childId, { x: childCenterX - cs.width / 2, y: childY });
        }
        cursorX += cw + CHILD_GAP;
      });
    }
  }

  // ─── Root unions (founders who are not children of any other union) ────────
  const allUnionIds  = inputNodes.filter(n => isUnionNodeId(n.id)).map(n => n.id);
  const rootUnionIds = allUnionIds.filter(uid => {
    if (crossBranchUnions.has(uid)) return false;
    const parents = parentsByUnion.get(uid) ?? [];
    return parents.every(pid => !parentUnionOf.has(pid));
  });

  let rootCursorX = 0;
  rootUnionIds.forEach(uid => {
    const w = unionSubtreeWidth(uid);
    positionUnion(uid, rootCursorX + w / 2, 0);
    rootCursorX += w + CHILD_GAP;
  });

  // ─── Second pass: place cross-branch couples ──────────────────────────────
  // Sort by generation (shallow first) so parent cross-branches are placed before children.
  const crossBranchList = [...crossBranchUnions].sort((a, b) => {
    const genOf = (uid: string) => {
      const ps = parentsByUnion.get(uid) ?? [];
      return ps.reduce((mx, pid) => {
        const pos = positions.get(pid);
        return Math.max(mx, pos ? Math.round(pos.y / ROW_HEIGHT) : 0);
      }, 0);
    };
    return genOf(a) - genOf(b);
  });

  crossBranchList.forEach(uid => {
    if (visitedUnions.has(uid)) return;
    visitedUnions.add(uid);

    const parents  = parentsByUnion.get(uid)  ?? [];
    const children = childrenByUnion.get(uid) ?? [];
    if (parents.length < 2) return;

    const [lId, rId] = parents;
    const lW = sizeOf(lId).width;
    const lH = sizeOf(lId).height;
    const posL = positions.get(lId);
    const posR = positions.get(rId);

    // Determine couple Y: use the maximum (deepest) generation of the two parents
    const lY = posL?.y ?? 0;
    const rY = posR?.y ?? 0;
    const coupleY = Math.max(lY, rY);

    // Center the couple at the midpoint of where the two parents currently are
    const lCX = (posL?.x ?? 0) + lW / 2;
    const rCX = (posR?.x ?? 0) + sizeOf(rId).width / 2;
    const coupleCenterX = (lCX + rCX) / 2;

    // Place both parents adjacent around that center
    positions.set(lId, { x: coupleCenterX - SPOUSE_GAP / 2 - lW,    y: coupleY });
    positions.set(rId, { x: coupleCenterX + SPOUSE_GAP / 2,          y: coupleY });
    positions.set(uid, {
      x: coupleCenterX - LAYOUT_UNION_NODE_WIDTH / 2,
      y: coupleY + (lH - LAYOUT_UNION_NODE_HEIGHT) / 2,
    });

    // Place children below
    if (children.length > 0) {
      const childGen  = Math.round(coupleY / ROW_HEIGHT) + 1;
      const childY    = childGen * ROW_HEIGHT;
      const totalSpan = children.reduce((sum, cid, i) =>
        sum + memberSubtreeWidth(cid) + (i > 0 ? CHILD_GAP : 0), 0);
      let cursorX = coupleCenterX - totalSpan / 2;

      children.forEach(childId => {
        const cw           = memberSubtreeWidth(childId);
        const childCenterX = cursorX + cw / 2;
        const childUnions  = (ownUnionsOf.get(childId) ?? []).filter(
          cuid => !crossBranchUnions.has(cuid));

        if (childUnions.length > 0) {
          childUnions.forEach(cuid => positionUnion(cuid, childCenterX, childGen));
        } else {
          const cs = sizeOf(childId);
          positions.set(childId, { x: childCenterX - cs.width / 2, y: childY });
        }
        cursorX += cw + CHILD_GAP;
      });
    }
  });

  // ─── Third pass: deterministic couple centering around union nodes ─────────
  // Snap each spouse pair to be exactly SPOUSE_GAP apart, centered on their union dot.
  // Process deeper generations first so shallow cross-branch unions see their children
  // already placed before the shallow union gets snapped.
  const unionsByDepth = [...allUnionIds].sort((a, b) => {
    const depthOf = (uid: string) => {
      const ps = parentsByUnion.get(uid) ?? [];
      return ps.reduce((mx, pid) => {
        const pos = positions.get(pid);
        return Math.max(mx, pos ? Math.round(pos.y / ROW_HEIGHT) : 0);
      }, 0);
    };
    return depthOf(b) - depthOf(a); // deepest first
  });

  unionsByDepth.forEach(uid => {
    const parents = parentsByUnion.get(uid) ?? [];
    if (parents.length < 2) return;
    const posA = positions.get(parents[0]);
    const posB = positions.get(parents[1]);
    const unionPos = positions.get(uid);
    if (!posA || !posB || !unionPos) return;
    const sA = sizeOf(parents[0]);
    const sB = sizeOf(parents[1]);
    const unionCenterX = unionPos.x + LAYOUT_UNION_NODE_WIDTH / 2;
    const coupleY = Math.max(posA.y, posB.y);
    const [leftId, rightId] = posA.x <= posB.x ? [parents[0], parents[1]] : [parents[1], parents[0]];
    const leftSize = sizeOf(leftId);
    positions.set(leftId, { x: unionCenterX - SPOUSE_GAP / 2 - leftSize.width, y: coupleY });
    positions.set(rightId, { x: unionCenterX + SPOUSE_GAP / 2, y: coupleY });
    positions.set(uid, {
      x: unionCenterX - LAYOUT_UNION_NODE_WIDTH / 2,
      y: coupleY + (Math.max(sA.height, sB.height) - LAYOUT_UNION_NODE_HEIGHT) / 2,
    });
  });

  // ─── Fourth pass: per-generation overlap resolution with cascade ───────────
  // Each couple (left spouse + right spouse + union dot) is treated as one
  // indivisible "atom".  Atoms within the same generation are sorted by their left
  // edge and forward-swept so no two atoms overlap.
  // CRITICAL: when an atom is shifted, ALL of its descendants are cascade-shifted
  // by the same delta so children never become misaligned from their parents.
  type Atom = { leftX: number; rightX: number; nodeIds: string[] };
  const atomsByGen = new Map<number, Atom[]>();
  const assignedToAtom = new Set<string>();
  const MIN_ATOM_GAP = 30;

  // Helper: recursively shift a node and all its descendants downward in the tree
  const cascadeShiftDown = (nodeId: string, delta: number, visited: Set<string>): void => {
    if (visited.has(nodeId) || Math.abs(delta) < 0.5) return;
    visited.add(nodeId);
    const cpos = positions.get(nodeId);
    if (cpos) positions.set(nodeId, { x: cpos.x + delta, y: cpos.y });
    if (isUnionNodeId(nodeId)) {
      // Union → cascade to its children (members going downward)
      (childrenByUnion.get(nodeId) ?? []).forEach(cid => cascadeShiftDown(cid, delta, visited));
    } else {
      // Member → cascade to unions where this member is a PARENT (their own couples/children)
      (ownUnionsOf.get(nodeId) ?? []).forEach(uid => cascadeShiftDown(uid, delta, visited));
    }
  };

  // Build couple atoms (two parents + union node per couple)
  allUnionIds.forEach(uid => {
    const parents = parentsByUnion.get(uid) ?? [];
    if (parents.length < 2) return;
    if (assignedToAtom.has(parents[0]) || assignedToAtom.has(parents[1])) return;
    const posA = positions.get(parents[0]);
    const posB = positions.get(parents[1]);
    if (!posA || !posB) return;
    const gen = Math.round(Math.min(posA.y, posB.y) / ROW_HEIGHT);
    const [leftId, rightId] = posA.x <= posB.x ? [parents[0], parents[1]] : [parents[1], parents[0]];
    const leftPos = positions.get(leftId)!;
    const rightPos = positions.get(rightId)!;
    if (!atomsByGen.has(gen)) atomsByGen.set(gen, []);
    atomsByGen.get(gen)!.push({
      leftX: leftPos.x,
      rightX: rightPos.x + sizeOf(rightId).width,
      nodeIds: [leftId, rightId, uid],
    });
    assignedToAtom.add(parents[0]);
    assignedToAtom.add(parents[1]);
  });

  // Build solo-member atoms (leaf nodes, single-parent children, etc.)
  inputNodes.forEach(n => {
    if (isUnionNodeId(n.id) || assignedToAtom.has(n.id)) return;
    const pos = positions.get(n.id);
    if (!pos) return;
    const gen = Math.round(pos.y / ROW_HEIGHT);
    if (!atomsByGen.has(gen)) atomsByGen.set(gen, []);
    atomsByGen.get(gen)!.push({
      leftX: pos.x,
      rightX: pos.x + sizeOf(n.id).width,
      nodeIds: [n.id],
    });
  });

  // Process generations top-down so cascade shifts from a shallow generation are
  // reflected in atom boundaries before the deeper generation is swept.
  const sortedGens = [...atomsByGen.keys()].sort((a, b) => a - b);
  sortedGens.forEach(gen => {
    const atoms = atomsByGen.get(gen)!;
    if (atoms.length < 2) return;

    // Re-sync each atom's boundaries from the ACTUAL current positions.
    // A cascade from the parent generation may already have shifted some atoms.
    atoms.forEach(atom => {
      const memberIds = atom.nodeIds.filter(id => !isUnionNodeId(id));
      if (memberIds.length === 0) return;
      let minX = Infinity, maxX = -Infinity;
      memberIds.forEach(id => {
        const p = positions.get(id);
        if (!p) return;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x + sizeOf(id).width);
      });
      if (minX < Infinity) { atom.leftX = minX; atom.rightX = maxX; }
    });

    atoms.sort((a, b) => a.leftX - b.leftX);
    let rightBound = atoms[0].rightX;
    for (let i = 1; i < atoms.length; i++) {
      const atom = atoms[i];
      const needed = rightBound + MIN_ATOM_GAP;
      if (atom.leftX < needed) {
        const delta = needed - atom.leftX;
        const cascadeVisited = new Set<string>(atom.nodeIds);

        // Shift the atom's own nodes
        atom.nodeIds.forEach(id => {
          const pos = positions.get(id);
          if (pos) positions.set(id, { x: pos.x + delta, y: pos.y });
        });

        // Cascade the shift to ALL descendants so children stay below their parents
        atom.nodeIds.forEach(id => {
          if (isUnionNodeId(id)) {
            (childrenByUnion.get(id) ?? []).forEach(cid =>
              cascadeShiftDown(cid, delta, cascadeVisited));
          } else {
            (ownUnionsOf.get(id) ?? []).forEach(uid =>
              cascadeShiftDown(uid, delta, cascadeVisited));
          }
        });

        atom.leftX += delta;
        atom.rightX += delta;
      }
      rightBound = atom.rightX;
    }
  });

  // Re-anchor single-parent union nodes if their parent was shifted
  allUnionIds.forEach(uid => {
    const parents = parentsByUnion.get(uid) ?? [];
    if (parents.length !== 1) return;
    const parentPos = positions.get(parents[0]);
    const existingUnionPos = positions.get(uid);
    if (!parentPos || !existingUnionPos) return;
    const ps = sizeOf(parents[0]);
    positions.set(uid, {
      x: parentPos.x + ps.width / 2 - LAYOUT_UNION_NODE_WIDTH / 2,
      y: existingUnionPos.y,
    });
  });

  // ─── Fallback for any unpositioned node ───────────────────────────────────
  inputNodes.forEach(n => {
    if (!positions.has(n.id)) positions.set(n.id, n.position);
  });

  // ─── Apply positions ───────────────────────────────────────────────────────
  const nodes = inputNodes.map(n => ({
    ...n,
    position: positions.get(n.id) ?? n.position,
  }));

  return { nodes, edges: inputEdges };
}

// Compute IDs of all nodes reachable downward from a root member (subtree).
// Also includes sibling parents (spouses) connected via the same union node.
function computeSubtreeIds(rootId: string, allNodes: Node[], allEdges: Edge[]): Set<string> {
  const visible = new Set<string>();
  const queue = [rootId];

  // source → targets map (forward traversal)
  const adj = new Map<string, string[]>();
  allEdges.forEach(e => {
    const targets = adj.get(e.source) ?? [];
    targets.push(e.target);
    adj.set(e.source, targets);
  });

  // union → all its parent members (to include the spouse when we reach a union)
  const unionParents = new Map<string, string[]>();
  allEdges.forEach(e => {
    if (isUnionNodeId(e.target) && !isUnionNodeId(e.source)) {
      const parents = unionParents.get(e.target) ?? [];
      parents.push(e.source);
      unionParents.set(e.target, parents);
    }
  });

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visible.has(id)) continue;
    visible.add(id);
    (adj.get(id) ?? []).forEach(target => {
      if (!visible.has(target)) queue.push(target);
    });
    // When we reach a union node, also pull in its other parent (spouse)
    if (isUnionNodeId(id)) {
      (unionParents.get(id) ?? []).forEach(parent => {
        if (!visible.has(parent)) queue.push(parent);
      });
    }
  }
  return visible;
}

function extractMembersAndRelationshipsFromTree(
  root: TreeNodeUI | null,
  collapsedMemberIds: Set<string>,
  focusDescendantsOnly: boolean
): { members: TreeMemberUI[]; relationships: RawRelationship[]; spouses: Set<string>; spouseLinks: SpouseLink[]; membersWithDescendants: Set<string> } {
  if (!root) {
    return { members: [], relationships: [], spouses: new Set(), spouseLinks: [], membersWithDescendants: new Set() };
  }

  const memberMap = new Map<string, TreeMemberUI>();
  const queue: TreeNodeUI[] = [root];
  const visitedLineage = new Set<string>();
  const relationshipsByChild = new Map<string, Map<string, string[]>>();
  const spousePairs = new Set<string>();
  const spouseLinksMap = new Map<string, SpouseLink>();
  // Tracks members who have children regardless of collapse state, so the
  // collapse button remains visible even after the branch is collapsed.
  const membersWithDescendants = new Set<string>();

  const registerSpouseLink = (a: string, b: string) => {
    if (!a || !b || a === b) return;
    const [leftId, rightId] = [a, b].sort((x, y) => x.localeCompare(y));
    const key = `${leftId}::${rightId}`;
    if (!spouseLinksMap.has(key)) spouseLinksMap.set(key, { leftId, rightId });
  };

  const registerMember = (node: TreeNodeUI | null) => {
    if (!node) return;
    if (!memberMap.has(node.member.id)) memberMap.set(node.member.id, node.member);
  };

  const registerRelationship = (childId: string, parentIds: string[]) => {
    const normalizedParents = Array.from(new Set(parentIds)).filter(Boolean).sort((a, b) => a.localeCompare(b));
    if (!childId || normalizedParents.length === 0) return;
    const parentKey = normalizedParents.join(',');
    const currentMap = relationshipsByChild.get(childId) ?? new Map<string, string[]>();
    currentMap.set(parentKey, normalizedParents);
    relationshipsByChild.set(childId, currentMap);
  };

  const inferFallbackParents = (childNode: TreeNodeUI, primaryParentId: string): string[] => {
    const inferred = childNode.parents.map((parent) => parent.member.id).filter(Boolean);
    const merged = Array.from(new Set([primaryParentId, ...inferred]));
    return merged.length > 0 ? merged : [primaryParentId];
  };

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const currentId = current.member.id;
    if (visitedLineage.has(currentId)) continue;
    visitedLineage.add(currentId);
    registerMember(current);
    // Determine if this member has children in the ORIGINAL tree (before collapse filtering)
    const hasAnyChildren =
      current.children.length > 0 ||
      current.marriages.some((m) => m.children.length > 0);
    if (hasAnyChildren) membersWithDescendants.add(currentId);
    if (collapsedMemberIds.has(currentId)) continue;

    const marriageParentsByChild = new Map<string, string[]>();

    current.marriages.forEach((marriage) => {
      const spouse = marriage.spouse;
      const spouseId = spouse?.member.id;
      if (spouse) {
        registerMember(spouse);
        registerSpouseLink(currentId, spouseId || '');
        if (spouseId) spousePairs.add(spouseId);
        if (spouseId && !visitedLineage.has(spouseId)) queue.push(spouse);
      }
      marriage.children.forEach((child) => {
        registerMember(child);
        const parentIds = spouseId
          ? Array.from(new Set([currentId, spouseId]))
          : inferFallbackParents(child, currentId);
        marriageParentsByChild.set(child.member.id, parentIds);
        registerRelationship(child.member.id, parentIds);
        queue.push(child);
      });
    });

    current.children.forEach((child) => {
      registerMember(child);
      const parentIds = marriageParentsByChild.get(child.member.id) ?? inferFallbackParents(child, currentId);
      registerRelationship(child.member.id, parentIds);
      queue.push(child);
    });

    if (!focusDescendantsOnly) {
      current.parents.forEach((parent) => { registerMember(parent); });
    }

    current.spouses.forEach((spouse) => {
      registerMember(spouse);
      registerSpouseLink(currentId, spouse.member.id);
      spousePairs.add(spouse.member.id);
      if (!visitedLineage.has(spouse.member.id)) queue.push(spouse);
    });
  }

  const normalizedRelationships: RawRelationship[] = [];
  relationshipsByChild.forEach((relationMap, childId) => {
    const candidates = Array.from(relationMap.values());
    if (candidates.length === 0) return;
    candidates.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return a.join(',').localeCompare(b.join(','));
    });
    normalizedRelationships.push({ childId, parentIds: candidates[0] });
  });

  return {
    members: Array.from(memberMap.values()),
    relationships: normalizedRelationships,
    spouses: spousePairs,
    spouseLinks: Array.from(spouseLinksMap.values()),
    membersWithDescendants,
  };
}

function transformDataToElements(
  members: TreeMemberUI[],
  relationships: RawRelationship[],
  options: TransformOptions = {}
): { nodes: Node[]; edges: FlowEdge[] } {
  const {
    familyName,
    onRefresh,
    isMobile = false,
    isCompactMobile = false,
    collapsedMemberIds = new Set<string>(),
    onToggleCollapse,
    onFocusMember,
    spouses = new Set<string>(),
    spouseLinks = [],
    membersWithDescendants,
  } = options;

  const memberWidth = isCompactMobile
    ? COMPACT_MOBILE_MEMBER_NODE_WIDTH
    : isMobile
      ? MOBILE_MEMBER_NODE_WIDTH
      : MEMBER_NODE_WIDTH;
  const memberHeight = isCompactMobile
    ? COMPACT_MOBILE_MEMBER_NODE_HEIGHT
    : isMobile
      ? MOBILE_MEMBER_NODE_HEIGHT
      : MEMBER_NODE_HEIGHT;

  const memberById = new Map(members.map((member) => [member.id, member]));

  const normalizedRelationships = relationships.map((relationship) => ({
    childId: relationship.childId,
    parentIds: Array.from(new Set(relationship.parentIds)).filter(Boolean).sort((a, b) => a.localeCompare(b)),
  }));

  normalizedRelationships.sort((a, b) => {
    const aParentKey = a.parentIds.join('::');
    const bParentKey = b.parentIds.join('::');
    if (aParentKey !== bParentKey) {
      return aParentKey.localeCompare(bParentKey);
    }

    return compareMemberIdsForSiblingOrder(memberById, a.childId, b.childId);
  });

  const rootId = members[0]?.id;
  const childrenByParent = new Map<string, Set<string>>();

  normalizedRelationships.forEach((relationship) => {
    relationship.parentIds.forEach((parentId) => {
      const children = childrenByParent.get(parentId) ?? new Set<string>();
      children.add(relationship.childId);
      childrenByParent.set(parentId, children);
    });
  });

  const generationByMember = new Map<string, number>();
  if (rootId) {
    generationByMember.set(rootId, 0);
    const queue: string[] = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) {
        continue;
      }

      const currentGeneration = generationByMember.get(currentId) ?? 0;
      const children = childrenByParent.get(currentId) ?? new Set<string>();
      children.forEach((childId) => {
        const nextGeneration = currentGeneration + 1;
        const existingGeneration = generationByMember.get(childId);
        if (existingGeneration === undefined || nextGeneration > existingGeneration) {
          generationByMember.set(childId, nextGeneration);
          queue.push(childId);
        }
      });
    }
  }

  const descendantParentIds = new Set<string>();
  normalizedRelationships.forEach((relationship) => {
    relationship.parentIds.forEach((parentId) => descendantParentIds.add(parentId));
  });

  const nodes: Node[] = members.map((member) => ({
    id: member.id,
    type: 'member',
    position: { x: 0, y: 0 },
    data: {
      member,
      familyName,
      onRefresh,
      isMobile,
      isCompactMobile,
      isCollapsed: collapsedMemberIds.has(member.id),
      hasDescendants: (membersWithDescendants ?? descendantParentIds).has(member.id),
      onToggleCollapse,
      onFocusMember,
      layoutRank: (generationByMember.get(member.id) ?? 0) * 2,
    },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    style: {
      width: memberWidth,
      minHeight: memberHeight,
    },
  }));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: FlowEdge[] = [];
  const edgeIds = new Set<string>();
  const unionRankById = new Map<string, number>();

  const pushEdge = (edge: FlowEdge) => {
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    edges.push(edge);
  };

  const ensureUnionNode = (unionId: string) => {
    if (nodeIds.has(unionId)) {
      return;
    }

    nodes.push({
      id: unionId,
      type: 'union',
      position: { x: 0, y: 0 },
      data: {
        layoutRank: unionRankById.get(unionId) ?? 1,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: false,
      selectable: false,
      connectable: false,
      style: {
        width: LAYOUT_UNION_NODE_WIDTH,
        height: LAYOUT_UNION_NODE_HEIGHT,
      },
    });
    nodeIds.add(unionId);
  };

  const spouseLinkKeys = new Set(
    spouseLinks.map((link) => [link.leftId, link.rightId].sort((a, b) => a.localeCompare(b)).join('::'))
  );

  const hasExplicitCoupleLink = (parentIds: string[]): boolean => {
    if (parentIds.length < 2) {
      return false;
    }
    const pairKey = [parentIds[0], parentIds[1]].sort((a, b) => a.localeCompare(b)).join('::');
    return spouseLinkKeys.has(pairKey);
  };

  const spousePairsWithChildren = new Set(
    normalizedRelationships
      .filter((relationship) => relationship.parentIds.length >= 2 && hasExplicitCoupleLink(relationship.parentIds))
      .map((relationship) => [relationship.parentIds[0], relationship.parentIds[1]].sort((a, b) => a.localeCompare(b)).join('::'))
  );

  const singleParentChildIdsByParent = new Map<string, string[]>();
  normalizedRelationships.forEach((relationship) => {
    const isRealSingleParent = relationship.parentIds.length === 1;
    const isVisualSingleParent = relationship.parentIds.length >= 2 && !hasExplicitCoupleLink(relationship.parentIds);

    if (!isRealSingleParent && !isVisualSingleParent) {
      return;
    }

    const parentId = relationship.parentIds[0];
    const childIds = singleParentChildIdsByParent.get(parentId) ?? [];
    childIds.push(relationship.childId);
    singleParentChildIdsByParent.set(parentId, childIds);
  });

  const fanOutSourceHandles = [
    'source-bottom-far-left',
    'source-bottom-left',
    'source-bottom-center',
    'source-bottom-right',
    'source-bottom-far-right',
  ] as const;
  const fanOutTargetHandles = [
    'target-top-far-left',
    'target-top-left',
    'target-top-center',
    'target-top-right',
    'target-top-far-right',
  ] as const;

  const siblingHandlesForCouples = [
    { source: 'source-bottom-far-left', target: 'target-top-far-left' },
    { source: 'source-bottom-left', target: 'target-top-left' },
    { source: 'source-bottom-center', target: 'target-top-center' },
    { source: 'source-bottom-right', target: 'target-top-right' },
    { source: 'source-bottom-far-right', target: 'target-top-far-right' },
  ] as const;

  const childIdsByUnionId = new Map<string, string[]>();
  normalizedRelationships.forEach((relationship) => {
    if (relationship.parentIds.length < 2 || !hasExplicitCoupleLink(relationship.parentIds)) {
      return;
    }

    const unionId = `union-${relationship.parentIds.join('-')}`;
    const bucket = childIdsByUnionId.get(unionId) ?? [];
    bucket.push(relationship.childId);
    childIdsByUnionId.set(unionId, bucket);
  });

  childIdsByUnionId.forEach((childIds, unionId) => {
    const sorted = [...childIds].sort((a, b) => compareMemberIdsForSiblingOrder(memberById, a, b));
    childIdsByUnionId.set(unionId, sorted);
  });

  const singleParentUnionByParentId = new Map<string, string>();

  const ensureSingleParentUnionNode = (parentId: string) => {
    const existingUnionId = singleParentUnionByParentId.get(parentId);
    if (existingUnionId) {
      return existingUnionId;
    }

    const unionId = `union-single-${parentId}`;
    const parentGeneration = generationByMember.get(parentId) ?? 0;
    unionRankById.set(unionId, parentGeneration * 2 + 1);
    ensureUnionNode(unionId);
    singleParentUnionByParentId.set(parentId, unionId);

    pushEdge({
      id: `${parentId}->${unionId}`,
      source: parentId,
      target: unionId,
      type: 'step',
      sourceHandle: 'source-bottom-center',
      targetHandle: 'target-top-center',
      pathOptions: { borderRadius: 10, offset: 20 },
      weight: 5,
      animated: false,
      style: { stroke: '#1d4ed8', strokeWidth: 2.8 },
    });

    return unionId;
  };

  normalizedRelationships.forEach((relationship) => {
    const childId = relationship.childId;
    const parentIds = relationship.parentIds;

    if (!nodeIds.has(childId) || parentIds.length === 0) {
      return;
    }

    if (!parentIds.every((parentId) => nodeIds.has(parentId))) {
      return;
    }

    const isVisualSingleParent = parentIds.length >= 2 && !hasExplicitCoupleLink(parentIds);

    if (isVisualSingleParent) {
      const visualParentId = parentIds[0];
      const unionId = ensureSingleParentUnionNode(visualParentId);
      const siblingChildIds = singleParentChildIdsByParent.get(visualParentId) ?? [];
      const siblingIndex = Math.max(0, siblingChildIds.findIndex((id) => id === childId));
      const handleIndex = siblingIndex % fanOutSourceHandles.length;

      pushEdge({
        id: `${unionId}->${childId}`,
        source: unionId,
        target: childId,
        type: 'step',
        sourceHandle: fanOutSourceHandles[handleIndex],
        targetHandle: fanOutTargetHandles[handleIndex],
        pathOptions: { borderRadius: 10, offset: 20 },
        weight: 1,
        animated: false,
        style: { stroke: '#1d4ed8', strokeWidth: 3.5 },
        markerEnd: createMarkerArrow('#1d4ed8'),
      });

      return;
    }

    if (parentIds.length >= 2) {
      const unionId = `union-${parentIds.join('-')}`;
      const maxParentGeneration = parentIds.reduce(
        (maxGeneration, parentId) => Math.max(maxGeneration, generationByMember.get(parentId) ?? 0),
        0
      );
      unionRankById.set(unionId, maxParentGeneration * 2 + 1);
      ensureUnionNode(unionId);

      const [leftParentId, rightParentId] = parentIds
        .slice(0, 2)
        .sort((a, b) => a.localeCompare(b));

      parentIds.forEach((parentId) => {
        const isLeftParent = parentId === leftParentId;
        pushEdge({
          id: `${parentId}->${unionId}`,
          source: parentId,
          target: unionId,
          type: 'straight',
          sourceHandle: isLeftParent ? 'source-right' : 'source-left',
          targetHandle: isLeftParent ? 'target-left' : 'target-right',
          weight: 25,
          animated: false,
          style: { stroke: '#22c55e', strokeWidth: 2.8 },
        });
      });

      pushEdge({
        id: `${unionId}->${childId}`,
        source: unionId,
        target: childId,
        type: 'step',
        sourceHandle: siblingHandlesForCouples[
          Math.max(0, (childIdsByUnionId.get(unionId) ?? []).findIndex((id) => id === childId)) %
            siblingHandlesForCouples.length
        ].source,
        targetHandle: siblingHandlesForCouples[
          Math.max(0, (childIdsByUnionId.get(unionId) ?? []).findIndex((id) => id === childId)) %
            siblingHandlesForCouples.length
        ].target,
        pathOptions: { borderRadius: 10, offset: 20 },
        weight: 1,
        animated: false,
        style: { stroke: '#16a34a', strokeWidth: 3.5 },
        markerEnd: createMarkerArrow('#16a34a'),
      });

      return;
    }

    const unionId = ensureSingleParentUnionNode(parentIds[0]);
    const siblingChildIds = singleParentChildIdsByParent.get(parentIds[0]) ?? [];
    const siblingIndex = Math.max(0, siblingChildIds.findIndex((id) => id === childId));
    const handleIndex = siblingIndex % fanOutSourceHandles.length;

    pushEdge({
      id: `${unionId}->${childId}`,
      source: unionId,
      target: childId,
      type: 'step',
      sourceHandle: fanOutSourceHandles[handleIndex],
      targetHandle: fanOutTargetHandles[handleIndex],
      pathOptions: { borderRadius: 10, offset: 20 },
      weight: 1,
      animated: false,
      style: { stroke: '#1d4ed8', strokeWidth: 3.5 },
      markerEnd: createMarkerArrow('#1d4ed8'),
    });
  });

  spouseLinks.forEach((link) => {
    if (!nodeIds.has(link.leftId) || !nodeIds.has(link.rightId)) {
      return;
    }

    const sortedParentIds = [link.leftId, link.rightId].sort((a, b) => a.localeCompare(b));
    const key = sortedParentIds.join('::');
    if (spousePairsWithChildren.has(key)) {
      return;
    }

    // Build a real union even when there are no children so all couples share one layout model.
    const unionId = `union-${sortedParentIds.join('-')}`;
    const maxParentGeneration = sortedParentIds.reduce(
      (maxGeneration, parentId) => Math.max(maxGeneration, generationByMember.get(parentId) ?? 0),
      0
    );
    unionRankById.set(unionId, maxParentGeneration * 2 + 1);
    ensureUnionNode(unionId);

    const [leftParentId, rightParentId] = sortedParentIds;

    sortedParentIds.forEach((parentId) => {
      const isLeftParent = parentId === leftParentId;
      pushEdge({
        id: `${parentId}->${unionId}`,
        source: parentId,
        target: unionId,
        type: 'straight',
        sourceHandle: isLeftParent ? 'source-right' : 'source-left',
        targetHandle: isLeftParent ? 'target-left' : 'target-right',
        weight: 25,
        animated: false,
        style: { stroke: '#22c55e', strokeWidth: 2.5, strokeDasharray: '6 4' },
      });
    });


  });

  return { nodes, edges };
}

function FamilyTreeVisualizationInner({
  treeData,
  loading = false,
  familyName,
  onRefresh,
  focusDescendantsOnly = false,
}: FamilyTreeVisualizationProps) {
  const [collapsedMemberIds, setCollapsedMemberIds] = useState<Set<string>>(new Set());
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isNarrowMobile, setIsNarrowMobile] = useState(false);
  const [showDesktopSimplified, setShowDesktopSimplified] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [searchMatchedIds, setSearchMatchedIds] = useState<string[]>([]);
  const [searchCurrentIndex, setSearchCurrentIndex] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [focusedMemberId, setFocusedMemberId] = useState<string | null>(null);
  const { fitView } = useReactFlow();
  const denseTreeNodeCount = countTreeNodes(treeData);
  const isDenseTree = denseTreeNodeCount >= DENSE_TREE_NODE_THRESHOLD;

  // ─── Tree Statistics ───────────────────────────────────────────────────────
  const treeStats = useMemo(() => {
    if (!treeData) return null;
    const visited = new Set<string>();
    const queue: TreeNodeUI[] = [treeData];
    let totalCount = 0;
    let maleCount = 0;
    let femaleCount = 0;
    let deceasedCount = 0;
    let externalCount = 0;
    let maxGeneration = 0;
    const generationMap = new Map<string, number>();
    generationMap.set(treeData.member.id, 0);
    const birthsByDecade = new Map<string, number>();

    while (queue.length > 0) {
      const node = queue.shift()!;
      const id = node.member.id;
      if (visited.has(id)) continue;
      visited.add(id);
      totalCount++;
      const m = node.member;
      const gender = m.gender ? String(m.gender).toUpperCase() : 'OTHER';
      if (gender === 'MALE') maleCount++;
      else if (gender === 'FEMALE') femaleCount++;
      if (m.dateOfDeath) deceasedCount++;
      if (m.isExternal || m.externalOriginText) externalCount++;
      if (m.dateOfBirth) {
        const yr = new Date(m.dateOfBirth).getFullYear();
        if (yr > 1700 && yr <= new Date().getFullYear()) {
          const decade = `${Math.floor(yr / 10) * 10}`;
          birthsByDecade.set(decade, (birthsByDecade.get(decade) ?? 0) + 1);
        }
      }
      const myGen = generationMap.get(id) ?? 0;
      if (myGen > maxGeneration) maxGeneration = myGen;
      node.marriages.forEach(mar => {
        if (mar.spouse && !visited.has(mar.spouse.member.id)) {
          generationMap.set(mar.spouse.member.id, myGen);
          queue.push(mar.spouse);
        }
        mar.children.forEach(ch => {
          if (!visited.has(ch.member.id)) {
            generationMap.set(ch.member.id, myGen + 1);
            queue.push(ch);
          }
        });
      });
      node.children.forEach(ch => {
        if (!visited.has(ch.member.id)) {
          generationMap.set(ch.member.id, myGen + 1);
          queue.push(ch);
        }
      });
      node.spouses.forEach(sp => {
        if (!visited.has(sp.member.id)) {
          generationMap.set(sp.member.id, myGen);
          queue.push(sp);
        }
      });
    }

    const decadesEntries = [...birthsByDecade.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]));
    const maxBirthsInDecade = Math.max(...decadesEntries.map(([, v]) => v), 1);

    return {
      totalCount,
      maleCount,
      femaleCount,
      deceasedCount,
      externalCount,
      generationsCount: maxGeneration + 1,
      decadesEntries,
      maxBirthsInDecade,
    };
  }, [treeData]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const widthQuery = window.matchMedia('(max-width: 767px)');
    const narrowWidthQuery = window.matchMedia('(max-width: 430px)');

    const syncLayoutMode = () => {
      setIsMobile(widthQuery.matches);
      setIsNarrowMobile(narrowWidthQuery.matches);
    };

    syncLayoutMode();
    widthQuery.addEventListener('change', syncLayoutMode);
    narrowWidthQuery.addEventListener('change', syncLayoutMode);

    return () => {
      widthQuery.removeEventListener('change', syncLayoutMode);
      narrowWidthQuery.removeEventListener('change', syncLayoutMode);
    };
  }, []);

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

  const handleToggleDesktopSimplified = useCallback(() => {
    setShowDesktopSimplified((previous) => !previous);
  }, []);

  // ─── Search & Highlight ────────────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchMatchCount(0);
      setSearchMatchedIds([]);
      setSearchCurrentIndex(0);
      setNodes(prev => prev.map(n =>
        isUnionNodeId(n.id) ? n : { ...n, data: { ...n.data, isHighlighted: false, isDimmed: false } }
      ));
      return;
    }
    const matchedIds: string[] = [];
    setNodes(prev => {
      const updated = prev.map(n => {
        if (isUnionNodeId(n.id)) return n;
        const m = (n.data as any).member as TreeMemberUI;
        const nameStr = [m.fullName, m.firstName, m.lastName, m.nickname]
          .filter(Boolean).join(' ').toLowerCase();
        const matches = nameStr.includes(q);
        if (matches && !matchedIds.includes(n.id)) matchedIds.push(n.id);
        return { ...n, data: { ...n.data, isHighlighted: matches, isDimmed: !matches } };
      });
      return updated;
    });
    requestAnimationFrame(() => {
      setSearchMatchCount(matchedIds.length);
      setSearchMatchedIds(matchedIds);
      setSearchCurrentIndex(0);
      if (matchedIds.length > 0) {
        fitView({
          nodes: [{ id: matchedIds[0] }],
          duration: 600,
          padding: 0.5,
          maxZoom: 1.5,
        });
      }
    });
  }, [searchQuery, fitView, setNodes]);

  const navigateToResult = useCallback((dir: 1 | -1) => {
    if (searchMatchedIds.length === 0) return;
    const next = (searchCurrentIndex + dir + searchMatchedIds.length) % searchMatchedIds.length;
    setSearchCurrentIndex(next);
    fitView({
      nodes: [{ id: searchMatchedIds[next] }],
      duration: 500,
      padding: 0.4,
      maxZoom: 1.5,
    });
  }, [searchMatchedIds, searchCurrentIndex, fitView]);

  useEffect(() => {
    if (isMobile) {
      return;
    }

    setShowDesktopSimplified(isDenseTree);
  }, [isMobile, isDenseTree, treeData?.member.id]);

  useEffect(() => {
    if (treeData && !loading) {
      const { members, relationships, spouses, spouseLinks, membersWithDescendants } = extractMembersAndRelationshipsFromTree(
        treeData,
        collapsedMemberIds,
        focusDescendantsOnly
      );

      const { nodes: rawNodes, edges: rawEdges } = transformDataToElements(
        members,
        relationships,
        {
          familyName,
          onRefresh,
          isMobile,
          isCompactMobile: isNarrowMobile || showDesktopSimplified,
          collapsedMemberIds,
          onToggleCollapse: handleToggleCollapse,
          onFocusMember: setFocusedMemberId,
          spouses,
          spouseLinks,
          membersWithDescendants,
        }
      );

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges);

      // Focus mode: show only the focused member's subtree
      let finalNodes = layoutedNodes;
      let finalEdges = layoutedEdges;
      if (focusedMemberId) {
        const subtreeIds = computeSubtreeIds(focusedMemberId, layoutedNodes, layoutedEdges);
        finalNodes = layoutedNodes.filter(n => subtreeIds.has(n.id));
        finalEdges = layoutedEdges.filter(e => subtreeIds.has(e.source) && subtreeIds.has(e.target));
      }

      setNodes(finalNodes);
      setEdges(finalEdges);

      if (focusedMemberId) {
        requestAnimationFrame(() =>
          fitView({ duration: 700, padding: 0.25, maxZoom: 1.5 })
        );
      }
    }
  }, [
    treeData,
    loading,
    familyName,
    onRefresh,
    collapsedMemberIds,
    isMobile,
    isNarrowMobile,
    showDesktopSimplified,
    focusDescendantsOnly,
    focusedMemberId,
    setNodes,
    setEdges,
  ]);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <p>جاري تحميل الشجرة...</p>
        </div>
      </div>
    );
  }

  if (!treeData || nodes.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#94a3b8' }}>لا تتوفر بيانات شجرة حالياً</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 320, position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        panOnScroll
        panOnDrag
        selectionOnDrag={false}
        zoomOnScroll={false}
        minZoom={0.03}
        maxZoom={3}
      >
        <Background color="#334155" gap={22} size={1} />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          nodeColor={() => '#6366f1'}
          maskColor="rgba(0,0,0,0.1)"
          style={{ width: 180, height: 120 }}
        />

        {/* ── Search Panel ── */}
        <Panel position="top-left">
          <div style={{
            background: 'rgba(15,23,42,0.92)',
            border: '1px solid #334155',
            borderRadius: 10,
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minWidth: isMobile ? 160 : 220,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, direction: 'rtl' }}>
              {/* search icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="ابحث عن فرد..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f1f5f9',
                  fontSize: 13,
                  flex: 1,
                  direction: 'rtl',
                  fontFamily: 'inherit',
                  minWidth: 0,
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                  title="مسح البحث"
                >
                  ✕
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: searchMatchCount > 0 ? 'space-between' : 'flex-end',
                direction: 'rtl',
                marginTop: 2,
              }}>
                <span style={{
                  fontSize: 11,
                  color: searchMatchCount > 0 ? '#4ade80' : '#f87171',
                }}>
                  {searchMatchCount > 0 ? `${searchCurrentIndex + 1} / ${searchMatchCount}` : 'لا توجد نتائج'}
                </span>
                {searchMatchCount > 1 && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      onClick={() => navigateToResult(-1)}
                      title="السابق"
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '1px 4px', borderRadius: 4 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                    >›</button>
                    <button
                      onClick={() => navigateToResult(1)}
                      title="التالي"
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '1px 4px', borderRadius: 4 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                    >‹</button>
                  </div>
                )}
              </div>
            )}
            {/* Exit focus mode banner */}
            {focusedMemberId && (
              <div style={{ marginTop: 6, borderTop: '1px solid #334155', paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: 'rtl', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {/* target icon */}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                  </svg>
                  وضع التركيز
                </span>
                <button
                  onClick={() => setFocusedMemberId(null)}
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', cursor: 'pointer' }}
                >
                  خروج
                </button>
              </div>
            )}
          </div>
        </Panel>

        {!isMobile && (
          <Panel position="bottom-center">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, background: 'rgba(15,23,42,0.8)', border: '1px solid #334155', padding: '8px 12px' }}>
              <button
                onClick={handleToggleDesktopSimplified}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: showDesktopSimplified ? '#059669' : '#334155',
                  color: '#f1f5f9',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
                title={showDesktopSimplified ? 'عرض مبسط مفعل للشجرة الكبيرة' : 'تفعيل العرض المبسط للشجرة الكبيرة'}
              >
                {showDesktopSimplified ? `عرض مبسط (${denseTreeNodeCount})` : `عرض كامل (${denseTreeNodeCount})`}
              </button>
            </div>
          </Panel>
        )}

        {(familyName || onRefresh || treeStats) && (
          <Panel position="top-right">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, direction: 'rtl' }}>
              {/* Family name + refresh + stats toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, background: 'rgba(15,23,42,0.9)', border: '1px solid #334155', padding: '8px 12px', color: '#f1f5f9' }}>
                {familyName && <span style={{ fontSize: 14, fontWeight: 600 }}>{familyName}</span>}
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, background: '#334155', color: '#f1f5f9', border: 'none', cursor: 'pointer' }}
                  >
                    تحديث
                  </button>
                )}
                {treeStats && (
                  <button
                    type="button"
                    onClick={() => setShowStats(s => !s)}
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, background: showStats ? '#4f46e5' : '#334155', color: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    title="إحصاءات الشجرة"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                    إحصاءات
                  </button>
                )}
              </div>

              {/* Stats panel */}
              {showStats && treeStats && (
                <div style={{
                  background: 'rgba(15,23,42,0.96)',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  padding: '14px 16px',
                  color: '#f1f5f9',
                  minWidth: 220,
                  maxWidth: 260,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  direction: 'rtl',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, borderBottom: '1px solid #334155', paddingBottom: 6, color: '#a5b4fc' }}>
                    إحصاءات الشجرة
                  </div>

                  {/* Grid of key stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: 12 }}>
                    {[
                      { label: 'إجمالي الأفراد', value: treeStats.totalCount, color: '#818cf8' },
                      { label: 'عدد الأجيال', value: treeStats.generationsCount, color: '#34d399' },
                      { label: 'الذكور', value: treeStats.maleCount, color: '#60a5fa' },
                      { label: 'الإناث', value: treeStats.femaleCount, color: '#f472b6' },
                      { label: 'المتوفون', value: treeStats.deceasedCount, color: '#f87171' },
                      { label: 'من خارج القرية', value: treeStats.externalCount, color: '#fbbf24' },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: stat.color, lineHeight: 1 }}>{stat.value}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.2 }}>{stat.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Births by decade bar chart */}
                  {treeStats.decadesEntries.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>المواليد حسب العقد</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {treeStats.decadesEntries.map(([decade, count]) => (
                          <div key={decade} style={{ display: 'flex', alignItems: 'center', gap: 6, direction: 'ltr' }}>
                            <span style={{ fontSize: 10, color: '#64748b', width: 36, textAlign: 'right', flexShrink: 0 }}>{decade}s</span>
                            <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.round((count / treeStats.maxBirthsInDecade) * 100)}%`,
                                background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                                borderRadius: 4,
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: 10, color: '#a5b4fc', width: 22, textAlign: 'left', flexShrink: 0 }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

export default function FamilyTreeVisualization(props: FamilyTreeVisualizationProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeVisualizationInner {...props} />
    </ReactFlowProvider>
  );
}