"use client";

import { Handle, Position } from "@xyflow/react";

/**
 * Marriage/Union node - a small connector between spouses and their children.
 * Positioned between husband and wife, with children branching from it.
 */
export default function MarriageNode() {
  return (
    <div className="relative flex items-center justify-center">
      <Handle id="target-left" type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle id="target-right" type="target" position={Position.Right} style={{ opacity: 0 }} />
      <Handle id="target-top-left" type="target" position={Position.Top} style={{ left: "34%", opacity: 0 }} />
      <Handle id="target-top-center" type="target" position={Position.Top} style={{ left: "50%", opacity: 0 }} />
      <Handle id="target-top-right" type="target" position={Position.Top} style={{ left: "66%", opacity: 0 }} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle id="source-bottom-far-left" type="source" position={Position.Bottom} style={{ left: "18%", opacity: 0 }} />
      <Handle id="source-bottom-left" type="source" position={Position.Bottom} style={{ left: "34%", opacity: 0 }} />
      <Handle id="source-bottom-center" type="source" position={Position.Bottom} style={{ left: "50%", opacity: 0 }} />
      <Handle id="source-bottom-right" type="source" position={Position.Bottom} style={{ left: "66%", opacity: 0 }} />
      <Handle id="source-bottom-far-right" type="source" position={Position.Bottom} style={{ left: "82%", opacity: 0 }} />
      <Handle id="target-top" type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-100 shadow-sm" />
    </div>
  );
}