'use client'

import { useEffect, useState } from 'react'
import ReactFlowLib, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'

const containerStyle = {
  position: 'fixed' as const,
  top: 0, left: 0,
  width: '100vw',
  height: '100vh',
  zIndex: 9999,
  background: '#f8fafc'
}

function FlowInner({ villageId }: { villageId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/tree/village/${villageId}`)
      .then(r => r.json())
      .then(data => {
        setNodes(data.nodes || [])
        setEdges(data.edges || [])
        setReady(true)
      })
      .catch(err => setError(String(err)))
  }, [villageId])

  if (error) return (
    <div style={containerStyle}>
      <p>❌ {error}</p>
    </div>
  )

  if (!ready) return (
    <div style={containerStyle}>
      <p style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        fontSize: 20
      }}>
        ⏳ טוען עץ משפחה...
      </p>
    </div>
  )

  return (
    <div style={containerStyle}>
      <ReactFlowLib
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.03}
        maxZoom={3}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background color="#e2e8f0" gap={24} />
        <Controls />
        <MiniMap />
      </ReactFlowLib>
    </div>
  )
}

export default function FamilyTreeCanvas({ 
  villageId 
}: { 
  villageId: string 
}) {
  return (
    <ReactFlowProvider>
      <FlowInner villageId={villageId} />
    </ReactFlowProvider>
  )
}