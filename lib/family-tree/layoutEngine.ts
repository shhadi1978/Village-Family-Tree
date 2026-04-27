import dagre from '@dagrejs/dagre'
import { Node, Edge } from '@xyflow/react'

export function applyFamilyLayout(nodes: Node[], edges: Edge[]): Node[] {
  // Defensive validation: ensure inputs are valid arrays
  if (!Array.isArray(nodes) || nodes.length === 0) {
    console.warn('[Layout] Invalid or empty nodes array:', nodes)
    return nodes || []
  }

  if (!Array.isArray(edges)) {
    console.warn('[Layout] Invalid edges array:', edges)
    edges = []
  }

  // Validate nodes have required properties
  const validNodes = nodes.filter(node => {
    if (!node || !node.id) {
      console.warn('[Layout] Skipping invalid node:', node)
      return false
    }
    return true
  })

  if (validNodes.length === 0) {
    console.warn('[Layout] No valid nodes after filtering')
    return nodes
  }

  // Validate edges
  const validEdges = edges.filter(edge => {
    if (!edge || !edge.id || !edge.source || !edge.target) {
      console.warn('[Layout] Skipping invalid edge:', edge)
      return false
    }
    return true
  })

  const g = new dagre.graphlib.Graph({
    multigraph: false,
    compound: false
  })

  g.setDefaultEdgeLabel(() => ({}))

  g.setGraph({
    rankdir: 'TB',
    nodesep: 40,       // מרווח קטן בין נודים באותה שורה
    ranksep: 120,      // מרווח בין דורות
    marginx: 80,
    marginy: 80,
    acyclicer: 'greedy',
    ranker: 'network-simplex'
  })

  // הגדר גדלי נודים
  const nodeIds = new Set<string>()
  validNodes.forEach((node) => {
    if (!node.id) return
    const width = node.type === 'marriageNode' ? 44 : 200
    const height = node.type === 'marriageNode' ? 44 : 100
    g.setNode(node.id, { width, height })
    nodeIds.add(node.id)
  })

  // הפרד קשתות לפי סוג
  const spouseEdges = validEdges.filter(e => {
    const hasValidNodes = nodeIds.has(e.source) && nodeIds.has(e.target)
    const isSpouseEdge = e.id?.startsWith('spouse-edge-') ?? false
    return isSpouseEdge && hasValidNodes
  })

  const parentChildEdges = validEdges.filter(e => {
    const hasValidNodes = nodeIds.has(e.source) && nodeIds.has(e.target)
    const isParentChildEdge = !(e.id?.startsWith('spouse-edge-') ?? false)
    return isParentChildEdge && hasValidNodes
  })

  // הוסף קשתות הורה-ילד לDagre (אלה קובעים את ההיררכיה)
  parentChildEdges.forEach((edge) => {
    try {
      g.setEdge(edge.source, edge.target)
    } catch (err) {
      console.warn('[Layout] Failed to add parent-child edge:', edge, err)
    }
  })

  // הוסף קשתות בני זוג עם weight גבוה (כדי להישאר צמודים)
  spouseEdges.forEach((edge) => {
    try {
      g.setEdge(edge.source, edge.target, { weight: 10, minlen: 0 })
    } catch (err) {
      console.warn('[Layout] Failed to add spouse edge:', edge, err)
    }
  })

  // Layout with error handling
  try {
    console.log('[Layout] Running dagre.layout with', nodeIds.size, 'nodes and', parentChildEdges.length + spouseEdges.length, 'edges')
    dagre.layout(g)
  } catch (err) {
    console.error('[Layout] Dagre layout failed:', err)
    console.error('[Layout] Graph nodes:', Array.from(g.nodes()))
    console.error('[Layout] Graph edges:', Array.from(g.edges()))
    return validNodes.map(n => ({ ...n, position: n.position || { x: 0, y: 0 } }))
  }

  // קבל פוזיציות מDagre
  const positionedNodes = validNodes.map((node) => {
    const dagreNode = g.node(node.id)
    if (!dagreNode) {
      console.warn('[Layout] No position found for node:', node.id)
      return { ...node, position: node.position || { x: 0, y: 0 } }
    }

    const width = node.type === 'marriageNode' ? 44 : 200
    const height = node.type === 'marriageNode' ? 44 : 100

    return {
      ...node,
      position: {
        x: dagreNode.x - width / 2,
        y: dagreNode.y - height / 2,
      }
    }
  })

  // תיקון: וודא שבני זוג באותה גובה (Y) כמו ה-marriage node
  const marriageNodes = positionedNodes.filter(n => n.type === 'marriageNode')

  marriageNodes.forEach((marriageNode) => {
    const marriageId = marriageNode.id.replace('marriage-', '')
    const marriageY = marriageNode.position.y + 22 // מרכז ה-marriage node

    // מצא את כל הקשתות שמגיעות ל-marriage node הזה
    const spouseEdgesToMarriage = spouseEdges.filter(
      e => e.target === marriageNode.id
    )

    // עדכן Y של בני הזוג להיות זהה
    spouseEdgesToMarriage.forEach((edge) => {
      const spouseIndex = positionedNodes.findIndex(n => n.id === edge.source)
      if (spouseIndex !== -1) {
        positionedNodes[spouseIndex] = {
          ...positionedNodes[spouseIndex],
          position: {
            x: positionedNodes[spouseIndex].position.x,
            y: marriageY - 50 // מרכז הנוד מול ה-marriage
          }
        }
      }
    })
  })

  return positionedNodes
}

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: applyFamilyLayout(nodes, edges),
    edges: edges.map((edge) => ({ ...edge })),
  }
}

export default applyDagreLayout