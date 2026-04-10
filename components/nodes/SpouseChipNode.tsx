"use client";

import { Handle, Position } from "reactflow";

type SpouseChipData = {
  spouse: {
    fullName?: string | null;
    photoUrl?: string | null;
    gender?: string | null;
  };
  expanded?: boolean;
};

interface SpouseChipNodeProps {
  data?: SpouseChipData;
}

function getInitials(name?: string | null) {
  const value = String(name || "").trim();
  if (!value) {
    return "؟";
  }

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 1);
  }

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
}

export default function SpouseChipNode({ data }: SpouseChipNodeProps) {
  const spouse = data?.spouse || {};
  const expanded = Boolean(data?.expanded);
  const gender = String(spouse.gender || "").toUpperCase();

  const tone =
    gender === "FEMALE"
      ? "border-rose-400/70 bg-rose-900/25"
      : gender === "MALE"
        ? "border-sky-400/70 bg-sky-900/25"
        : "border-slate-500/70 bg-slate-800/70";

  if (!expanded) {
    return (
      <div className={`relative rounded-full w-10 h-10 border ${tone} shadow-md`}>
        <Handle id="target-left" type="target" position={Position.Left} />
        <Handle id="source-left" type="source" position={Position.Left} />
        <Handle id="target-right" type="target" position={Position.Right} />
        <Handle id="source-right" type="source" position={Position.Right} />
        {spouse.photoUrl ? (
          <img
            src={spouse.photoUrl}
            alt={spouse.fullName || "زوج/زوجة"}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <div className="w-full h-full rounded-full flex items-center justify-center text-[11px] text-white font-semibold">
            {getInitials(spouse.fullName)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative min-w-28 max-w-36 rounded-lg border ${tone} px-2 py-1.5 shadow-lg`}>
      <Handle id="target-left" type="target" position={Position.Left} />
      <Handle id="source-left" type="source" position={Position.Left} />
      <Handle id="target-right" type="target" position={Position.Right} />
      <Handle id="source-right" type="source" position={Position.Right} />

      <div className="flex items-center gap-2">
        {spouse.photoUrl ? (
          <img
            src={spouse.photoUrl}
            alt={spouse.fullName || "زوج/زوجة"}
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-700 text-[10px] text-white flex items-center justify-center font-semibold">
            {getInitials(spouse.fullName)}
          </div>
        )}
        <p className="text-[11px] text-slate-100 leading-tight line-clamp-2">{spouse.fullName || "زوج/زوجة"}</p>
      </div>
    </div>
  );
}
