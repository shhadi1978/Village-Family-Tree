"use client";

import { Handle, Position } from "reactflow";

/**
 * Marriage/Union node - a small connector between spouses and their children.
 * Positioned between husband and wife, with children branching from it.
 */
export default function MarriageNode() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Minimal handles for spouse connections */}
      <Handle id="target-left" type="target" position={Position.Left} />
      <Handle id="target-right" type="target" position={Position.Right} />
      
      {/* Handles for children branching below */}
      <Handle id="source-bottom" type="source" position={Position.Bottom} />
      <Handle id="target-top" type="target" position={Position.Top} />
      
      {/* Small visual union circle */}
      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-white shadow-md" />
    </div>
  );
}