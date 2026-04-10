"use client";

import { Handle, Position } from "reactflow";

export default function MarriageNode() {
  return (
    <div className="relative flex items-center justify-center w-5 h-5">
      <Handle id="target-left" type="target" position={Position.Left} />
      <Handle id="source-left" type="source" position={Position.Left} />
      <Handle id="target-right" type="target" position={Position.Right} />
      <Handle id="source-right" type="source" position={Position.Right} />
      <Handle id="target-top" type="target" position={Position.Top} />
      <Handle id="source-top" type="source" position={Position.Top} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} />
      <div className="w-3 h-3 rounded-full border border-purple-300 bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.6)]" />
    </div>
  );
}