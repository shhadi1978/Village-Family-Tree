"use client";

import { Handle, Position } from "reactflow";

export default function MarriageNode() {
  return (
    <div className="relative flex items-center justify-center w-12 h-5">
      <Handle id="target-left" type="target" position={Position.Left} />
      <Handle id="source-left" type="source" position={Position.Left} />
      <Handle id="target-right" type="target" position={Position.Right} />
      <Handle id="source-right" type="source" position={Position.Right} />
      <Handle id="target-top" type="target" position={Position.Top} />
      <Handle id="source-top" type="source" position={Position.Top} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} />
      <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-[6px] rounded-full border border-fuchsia-300/80 bg-gradient-to-r from-fuchsia-500 via-pink-400 to-fuchsia-500 shadow-[0_0_16px_rgba(232,121,249,0.45)]" />
      <div className="relative z-10 w-3 h-3 rounded-full border border-white/70 bg-white shadow-[0_0_10px_rgba(255,255,255,0.35)]" />
    </div>
  );
}