"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Crosshair, ChevronDown, ChevronUp, MapPin, User } from "lucide-react";
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
  isExternal?: boolean;
  externalOriginText?: string | null;
  externalNotes?: string | null;
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
    isHighlighted?: boolean;
    isDimmed?: boolean;
    onToggleCollapse?: (memberId: string) => void;
    onFocusMember?: (memberId: string) => void;
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
    isHighlighted = false,
    isDimmed = false,
    onToggleCollapse,
    onFocusMember,
  } = data;
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const founder = isFamilyFounder(member, familyName);
  const isExternalMember =
    Boolean(member.isExternal) ||
    Boolean(member.externalOriginText) ||
    Boolean(member.externalNotes);

  const memberGender = member.gender ? String(member.gender).toUpperCase() : "OTHER";
  const isMale = memberGender === "MALE";
  const isFemale = memberGender === "FEMALE";

  // External members always get amber tone regardless of gender
  const memberCardTone = isExternalMember
    ? "bg-amber-900/20 border-amber-500 hover:border-amber-400"
    : isFemale
      ? "bg-rose-900/20 border-rose-500 hover:border-rose-400"
      : isMale
        ? "bg-blue-900/20 border-blue-500 hover:border-blue-400"
        : "bg-slate-800 border-slate-600 hover:border-blue-500";

  const avatarTone = isExternalMember
    ? "bg-gradient-to-br from-amber-500 to-orange-500 border-amber-400"
    : isFemale
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

  const handleFocusMember = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocusMember?.(member.id);
  };

  return (
    <>
      <div
        onClick={handleNodeClick}
        style={{ opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.2s' }}
        className={`relative rounded-lg p-4 shadow-lg transition border-2 cursor-pointer hover:shadow-xl ${
          isCompactMobile ? "w-36 p-3" : isMobile ? "w-44" : "w-64"
        } ${
          isHighlighted
            ? "ring-4 ring-yellow-400 ring-offset-1 shadow-[0_0_24px_4px_rgba(250,204,21,0.55)]"
            : ""
        } ${
          founder ? "founder-node-card" : memberCardTone
        }`}
      >
        <Handle id="target-top" type="target" position={Position.Top} style={{ opacity: 0 }} />
        <Handle id="target-top-far-left" type="target" position={Position.Top} style={{ left: "18%", opacity: 0 }} />
        <Handle id="target-top-left" type="target" position={Position.Top} style={{ left: "34%", opacity: 0 }} />
        <Handle id="target-top-center" type="target" position={Position.Top} style={{ left: "50%", opacity: 0 }} />
        <Handle id="target-top-right" type="target" position={Position.Top} style={{ left: "66%", opacity: 0 }} />
        <Handle id="target-top-far-right" type="target" position={Position.Top} style={{ left: "82%", opacity: 0 }} />
        <Handle id="source-top" type="source" position={Position.Top} style={{ opacity: 0 }} />
        <Handle id="target-right" type="target" position={Position.Right} style={{ opacity: 0 }} />
        <Handle id="source-right" type="source" position={Position.Right} style={{ opacity: 0 }} />
        <Handle id="target-bottom" type="target" position={Position.Bottom} style={{ opacity: 0 }} />
        <Handle id="source-bottom" type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        <Handle id="source-bottom-far-left" type="source" position={Position.Bottom} style={{ left: "18%", opacity: 0 }} />
        <Handle id="source-bottom-left" type="source" position={Position.Bottom} style={{ left: "34%", opacity: 0 }} />
        <Handle id="source-bottom-center" type="source" position={Position.Bottom} style={{ left: "50%", opacity: 0 }} />
        <Handle id="source-bottom-right" type="source" position={Position.Bottom} style={{ left: "66%", opacity: 0 }} />
        <Handle id="source-bottom-far-right" type="source" position={Position.Bottom} style={{ left: "82%", opacity: 0 }} />
        <Handle id="target-left" type="target" position={Position.Left} style={{ opacity: 0 }} />
        <Handle id="source-left" type="source" position={Position.Left} style={{ opacity: 0 }} />

        <div className="flex justify-center mb-2">
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt={member.fullName}
              className={`${isCompactMobile ? "w-10 h-10" : "w-12 h-12"} rounded-full object-cover border-2 ${
                founder
                  ? "founder-node-border"
                  : isExternalMember
                    ? "border-amber-400"
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

        {isExternalMember && (
          <>
            {/* Corner badge */}
            <div className="absolute top-2 end-2 flex items-center gap-0.5 rounded-full bg-amber-600/80 px-1.5 py-0.5">
              <MapPin className="w-2.5 h-2.5 text-amber-100" />
              {!isCompactMobile && <span className="text-[10px] text-amber-100 leading-none">خارجي</span>}
            </div>
            {member.externalOriginText && (
              <div className="mt-1 text-center">
                <p className="text-[11px] text-amber-300/90 line-clamp-1">{member.externalOriginText}</p>
              </div>
            )}
          </>
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
          <div className="mt-3 flex justify-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-900/40 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-800/50 transition"
            >
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              <span>{isCollapsed ? "عرض الفروع" : "طوي الفروع"}</span>
            </button>
            {onFocusMember && (
              <button
                type="button"
                onClick={handleFocusMember}
                title="عرض فرع هذا الفرد فقط"
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-900/40 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-800/50 transition"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>تركيز</span>
              </button>
            )}
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
