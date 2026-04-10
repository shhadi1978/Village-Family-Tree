"use client";

import { Handle, Position } from "reactflow";

interface BusNodeProps {
  data?: {
    width?: number;
    handleOffsets?: number[];
    label?: string;
    tone?: "direct" | "marriage";
  };
}

export default function BusNode({ data }: BusNodeProps) {
  const width = Math.max(72, data?.width || 72);
  const handleOffsets = data?.handleOffsets?.length ? data.handleOffsets : [50];
  const label = data?.label;
  const tone = data?.tone || "direct";
  const lineTone = tone === "marriage"
    ? "bg-gradient-to-r from-pink-400 via-fuchsia-300 to-pink-400 shadow-[0_0_18px_rgba(244,114,182,0.35)]"
    : "bg-gradient-to-r from-emerald-400 via-lime-300 to-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.35)]";
  const labelTone = tone === "marriage"
    ? "bg-pink-900/90 border-pink-500/70 text-pink-100"
    : "bg-emerald-900/90 border-emerald-500/70 text-emerald-100";

  return (
    <div className="relative h-10" style={{ width }}>
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        style={{ left: "50%", transform: "translateX(-50%)" }}
      />
      {label && (
        <div className={`absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis px-2 py-1 rounded-full border text-[11px] leading-none ${labelTone}`}>
          {label}
        </div>
      )}
      <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-[4px] rounded-full ${lineTone}`} />
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
