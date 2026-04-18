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
      <Handle id="source-bottom-far-left" type="source" position={Position.Bottom} style={{ width: 7, height: 7, left: "18%" }} />
      <Handle id="source-bottom-left" type="source" position={Position.Bottom} style={{ width: 7, height: 7, left: "34%" }} />
      <Handle id="source-bottom-center" type="source" position={Position.Bottom} style={{ width: 7, height: 7, left: "50%" }} />
      <Handle id="source-bottom-right" type="source" position={Position.Bottom} style={{ width: 7, height: 7, left: "66%" }} />
      <Handle id="source-bottom-far-right" type="source" position={Position.Bottom} style={{ width: 7, height: 7, left: "82%" }} />
    </div>
  );
}
