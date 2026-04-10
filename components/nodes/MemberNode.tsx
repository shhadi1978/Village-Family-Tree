"use client";

import { Handle, Position } from "reactflow";
import { User } from "lucide-react";
import { genderLabelAr, formatDateAr } from "@/lib/i18n/format";
import { getMemberDisplayName } from "@/lib/member-display";
import { isFamilyFounder } from "@/lib/member-founder";

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
};

interface MemberNodeProps {
  data: {
    member: MemberNodeData;
    familyName?: string;
  };
}

export default function MemberNode({ data }: MemberNodeProps) {
  const { member, familyName } = data;
  const founder = isFamilyFounder(member, familyName);
  const isMale = member.gender === "MALE";
  const isFemale = member.gender === "FEMALE";

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

  const genderTextTone = isFemale
    ? "text-rose-300"
    : isMale
      ? "text-blue-300"
      : "text-slate-300";

  return (
    <div
      className={`rounded-lg p-3 w-48 shadow-lg transition border-2 ${
        founder
          ? "founder-node-card"
          : memberCardTone
      }`}
    >
      {/* Connection points */}
      <Handle id="target-top" type="target" position={Position.Top} />
      <Handle id="source-top" type="source" position={Position.Top} />
      <Handle id="target-right" type="target" position={Position.Right} />
      <Handle id="source-right" type="source" position={Position.Right} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} />
      <Handle id="target-left" type="target" position={Position.Left} />
      <Handle id="source-left" type="source" position={Position.Left} />

      {/* Member Avatar */}
      <div className="flex justify-center mb-2">
        {member.photoUrl ? (
          <img
            src={member.photoUrl}
            alt={member.fullName}
            className={`w-12 h-12 rounded-full object-cover border-2 ${
              founder ? "founder-node-border" : "border-blue-500"
            }`}
          />
        ) : (
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
              founder
                ? "founder-avatar-gradient"
                : avatarTone
            }`}
          >
            <User className="w-6 h-6 text-white" />
          </div>
        )}
      </div>

      {/* Member Name */}
      <h3 className="text-white font-semibold text-center text-sm truncate">
        {getMemberDisplayName(member)}
      </h3>

      {founder && (
        <div className="mt-1 text-center">
          <span className="inline-block px-2 py-0.5 founder-badge text-[11px] rounded">
            مؤسس العائلة
          </span>
        </div>
      )}

      {/* Member Info */}
      <div className="mt-2 space-y-1 text-xs text-slate-400">
        {member.gender && (
          <p className={`text-center ${genderTextTone}`}>
            {genderLabelAr(member.gender)}
          </p>
        )}

        {member.dateOfBirth && (
          <p className="text-center">
            م. {formatDateAr(member.dateOfBirth)}
          </p>
        )}

        {member.dateOfDeath && (
          <p className="text-center text-red-400">
            و. {formatDateAr(member.dateOfDeath)}
          </p>
        )}
      </div>

      {/* Badge for deceased */}
      {member.dateOfDeath && (
        <div className="mt-2 text-center">
          <span className="inline-block px-2 py-1 bg-red-900 text-red-200 text-xs rounded">
            متوفى
          </span>
        </div>
      )}
    </div>
  );
}
