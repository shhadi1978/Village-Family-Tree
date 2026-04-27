'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MemberWithRelationships } from '@/lib/tree-logic';

type MemberNodeData = {
  member: MemberWithRelationships;
  isHighlighted: boolean;
  couplePosition?: 'left' | 'right' | 'none';
};

function getInitials(member: MemberWithRelationships): string {
  const first = member.firstName?.[0] ?? '';
  const last = member.lastName?.[0] ?? '';
  const initials = `${first}${last}`.trim();
  return initials ? initials.toUpperCase() : '?';
}

function getYear(value?: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return String(date.getFullYear());
}

function getLifeRange(member: MemberWithRelationships): string {
  const birthYear = getYear(member.dateOfBirth);
  const deathYear = getYear(member.dateOfDeath);

  if (!birthYear) {
    return 'לא ידוע';
  }

  return `${birthYear} – ${deathYear ?? 'בחיים'}`;
}

function getGenderStyles(member: MemberWithRelationships): string {
  if (member.gender === 'MALE') {
    return 'border-blue-400 bg-blue-50';
  }

  if (member.gender === 'FEMALE') {
    return 'border-pink-400 bg-pink-50';
  }

  return 'border-gray-400 bg-gray-50';
}

function getInitialsStyles(member: MemberWithRelationships): string {
  if (member.gender === 'MALE') {
    return 'bg-blue-200 text-blue-900';
  }

  if (member.gender === 'FEMALE') {
    return 'bg-pink-200 text-pink-900';
  }

  return 'bg-gray-200 text-gray-900';
}

const MemberNode = memo(function MemberNode({ data }: NodeProps<MemberNodeData>) {
  const { member, isHighlighted, couplePosition = 'none' } = data;

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {couplePosition === 'left' ? (
        <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />
      ) : null}
      {couplePosition === 'right' ? (
        <Handle type="source" position={Position.Left} id="left" style={{ opacity: 0 }} />
      ) : null}

      <div
        dir="rtl"
        className={[
          'relative w-[200px] rounded-xl border-2 p-3 cursor-pointer transition-all duration-200',
          getGenderStyles(member),
          isHighlighted ? '!border-yellow-400 !bg-yellow-50 ring-2 ring-yellow-300 shadow-lg' : '',
          member.isExternal ? 'border-dashed opacity-90' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {member.isFounder ? <span className="absolute top-1 left-1 text-xs">⭐</span> : null}
        {member.isExternal ? <span className="absolute bottom-1 left-1 text-xs">🌍</span> : null}

        <div className="flex items-center gap-2">
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt={member.fullName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div
              className={[
                'h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold',
                getInitialsStyles(member),
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {getInitials(member)}
            </div>
          )}

          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight truncate">{member.fullName}</div>
            {member.nickname ? (
              <div className="text-xs text-gray-500 italic truncate">{member.nickname}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-500">{getLifeRange(member)}</div>
      </div>

      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
    </>
  );
});

MemberNode.displayName = 'MemberNode';

export default MemberNode;
