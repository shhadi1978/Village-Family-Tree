"use client";

import { useState } from "react";
import { Handle, Position } from "reactflow";
import { ChevronDown, ChevronUp, User } from "lucide-react";
import { formatDateAr } from "@/lib/i18n/format";
import { getMemberDisplayName } from "@/lib/member-display";
import { isFamilyFounder } from "@/lib/member-founder";
import MemberDetailDialog from "@/components/dialogs/MemberDetailDialog";

type MemberNodeData = {
  id: string;
  fullName: string;
  nickname?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | Date | null;
  dateOfDeath?: string | Date | null;
  photoUrl?: string | null;
  familyId?: string;
  villageId?: string;
};

interface MemberNodeProps {
  data: {
    member: MemberNodeData;
    familyName?: string;
    onRefresh?: () => void;
    isMobile?: boolean;
    isCompactMobile?: boolean;
    isCollapsed?: boolean;
    hasDescendants?: boolean;
    onToggleCollapse?: (memberId: string) => void;
  };
}

export default function MemberNode({ data }: MemberNodeProps) {
  const {
    member,
    familyName,
    onRefresh,
    isMobile = false,
    isCompactMobile = false,
    isCollapsed = false,
    hasDescendants = false,
    onToggleCollapse,
  } = data;
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const founder = isFamilyFounder(member, familyName);

  const memberGender = member.gender ? String(member.gender).toUpperCase() : "OTHER";
  const isMale = memberGender === "MALE";
  const isFemale = memberGender === "FEMALE";

  const memberCardTone = isFemale
    ? "bg-rose-900/20 border-rose-500 hover:border-rose-400"
    : isMale
      ? "bg-blue-900/20 border-blue-500 hover:border-blue-400"
      : "bg-slate-800 border-slate-600 hover:border-blue-500";

  const avatarTone = isFemale
    ? "bg-gradient-to-br from-pink-500 to-rose-500 border-pink-400"
    : isMale
      ? "bg-gradient-to-br from-blue-500 to-cyan-500 border-blue-400"
      : "bg-gradient-to-br from-blue-500 to-purple-500 border-blue-500";

  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      if (!isExpanded) {
        setIsExpanded(true);
      } else {
        setIsDetailDialogOpen(true);
      }
    } else {
      setIsDetailDialogOpen(true);
    }
  };

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse?.(member.id);
  };

  return (
    <>
      <div
        onClick={handleNodeClick}
        className={`rounded-lg p-4 shadow-lg transition border-2 cursor-pointer hover:shadow-xl ${
          isCompactMobile ? "w-36 p-3" : isMobile ? "w-44" : "w-64"
        } ${
          founder ? "founder-node-card" : memberCardTone
        }`}
      >
        <Handle id="target-top" type="target" position={Position.Top} />
        <Handle id="target-top-far-left" type="target" position={Position.Top} style={{ left: "18%" }} />
        <Handle id="target-top-left" type="target" position={Position.Top} style={{ left: "34%" }} />
        <Handle id="target-top-center" type="target" position={Position.Top} style={{ left: "50%" }} />
        <Handle id="target-top-right" type="target" position={Position.Top} style={{ left: "66%" }} />
        <Handle id="target-top-far-right" type="target" position={Position.Top} style={{ left: "82%" }} />
        <Handle id="source-top" type="source" position={Position.Top} />
        <Handle id="target-right" type="target" position={Position.Right} />
        <Handle id="source-right" type="source" position={Position.Right} />
        <Handle id="target-bottom" type="target" position={Position.Bottom} />
        <Handle id="source-bottom" type="source" position={Position.Bottom} />
        <Handle id="source-bottom-far-left" type="source" position={Position.Bottom} style={{ left: "18%" }} />
        <Handle id="source-bottom-left" type="source" position={Position.Bottom} style={{ left: "34%" }} />
        <Handle id="source-bottom-center" type="source" position={Position.Bottom} style={{ left: "50%" }} />
        <Handle id="source-bottom-right" type="source" position={Position.Bottom} style={{ left: "66%" }} />
        <Handle id="source-bottom-far-right" type="source" position={Position.Bottom} style={{ left: "82%" }} />
        <Handle id="target-left" type="target" position={Position.Left} />
        <Handle id="source-left" type="source" position={Position.Left} />

        <div className="flex justify-center mb-2">
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt={member.fullName}
              className={`${isCompactMobile ? "w-10 h-10" : "w-12 h-12"} rounded-full object-cover border-2 ${
                founder
                  ? "founder-node-border"
                  : isFemale
                    ? "border-pink-400"
                    : isMale
                      ? "border-blue-400"
                      : "border-slate-400"
              }`}
            />
          ) : (
            <div
              className={`${isCompactMobile ? "w-10 h-10" : "w-12 h-12"} rounded-full flex items-center justify-center border-2 ${
                founder ? "founder-avatar-gradient" : avatarTone
              }`}
            >
              <User className={`${isCompactMobile ? "w-5 h-5" : "w-6 h-6"} text-white`} />
            </div>
          )}
        </div>

        <h3 className={`text-white font-semibold text-center ${isCompactMobile ? "text-xs" : "text-sm"} line-clamp-2`}>
          {getMemberDisplayName(member)}
        </h3>

        {founder && (
          <div className="mt-1 text-center">
            <span className="inline-block px-2 py-0.5 founder-badge text-[11px] rounded">
              مؤسس العائلة
            </span>
          </div>
        )}

        <div className="mt-2 space-y-1 text-xs text-slate-400">
          {(!isMobile || isExpanded) && member.dateOfBirth && <p className="text-center">م. {formatDateAr(member.dateOfBirth)}</p>}
          {(!isMobile || isExpanded) && member.dateOfDeath && <p className="text-center text-red-400">و. {formatDateAr(member.dateOfDeath)}</p>}
        </div>

        {member.dateOfDeath && (
          <div className="mt-2 text-center">
            {(!isMobile || isExpanded) && (
              <span className="inline-block px-2 py-1 bg-red-900 text-red-200 text-xs rounded">
                متوفى
              </span>
            )}
          </div>
        )}

        {hasDescendants && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-900/40 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-800/50 transition"
            >
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              <span>{isCollapsed ? "عرض الفروع" : "طوي الفروع"}</span>
            </button>
          </div>
        )}
      </div>

      <MemberDetailDialog
        member={member as any}
        isOpen={isDetailDialogOpen}
        onClose={() => setIsDetailDialogOpen(false)}
        onRefresh={onRefresh || (() => window.location.reload())}
        familyName={familyName}
      />
    </>
  );
}
