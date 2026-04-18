"use client";

import { Handle, Position } from "reactflow";

/**
 * Nexus node: invisible family junction point between spouses and children.
 */
export default function NexusNode() {
  return (
    <div className="relative w-2 h-2 rounded-full bg-transparent pointer-events-none">
      <Handle id="target-left" type="target" position={Position.Left} style={{ width: 7, height: 7 }} />
      <Handle id="target-right" type="target" position={Position.Right} style={{ width: 7, height: 7 }} />
      <Handle id="target-top" type="target" position={Position.Top} style={{ width: 7, height: 7 }} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={{ width: 7, height: 7 }} />
    </div>
  );
}
