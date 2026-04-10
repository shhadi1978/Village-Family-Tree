"use client";

import { Handle, Position } from "reactflow";

interface BusNodeProps {
  data?: {
    width?: number;
    handleOffsets?: number[];
  };
}

export default function BusNode({ data }: BusNodeProps) {
  const width = Math.max(72, data?.width || 72);
  const handleOffsets = data?.handleOffsets?.length ? data.handleOffsets : [50];

  return (
    <div className="relative h-4" style={{ width }}>
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        style={{ left: "50%", transform: "translateX(-50%)" }}
      />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[4px] rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.35)]" />
      {handleOffsets.map((offset, index) => (
        <Handle
          key={`child-${index}`}
          id={`child-${index}`}
          type="source"
          position={Position.Bottom}
          style={{ left: `${offset}%`, transform: "translateX(-50%)" }}
        />
      ))}
    </div>
  );
}
