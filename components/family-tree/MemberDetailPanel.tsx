'use client';

import type { MemberWithRelationships } from '@/lib/tree-logic';

type MemberDetailPanelProps = {
  member: MemberWithRelationships;
  onClose: () => void;
};

function getInitials(member: MemberWithRelationships): string {
  const first = member.firstName?.[0] ?? '';
  const last = member.lastName?.[0] ?? '';
  const text = `${first}${last}`.trim();
  return text ? text.toUpperCase() : '?';
}

function formatDate(value?: Date | string | null): string {
  if (!value) {
    return 'לא ידוע';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'לא ידוע';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());

  return `${day}/${month}/${year}`;
}

function getGenderLabel(gender: MemberWithRelationships['gender']): string {
  if (gender === 'MALE') {
    return 'זכר';
  }

  if (gender === 'FEMALE') {
    return 'נקבה';
  }

  return 'אחר';
}

export default function MemberDetailPanel({ member, onClose }: MemberDetailPanelProps) {
  return (
    <aside
      dir="rtl"
      className="fixed right-0 top-0 h-full w-80 md:w-96 bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200"
    >
      <header className="sticky top-0 bg-white border-b border-gray-200 p-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 left-3 h-8 w-8 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          aria-label="סגירה"
        >
          ✕
        </button>

        <div className="flex flex-col items-center text-center gap-3 pt-2">
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt={member.fullName}
              className="h-20 w-20 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-slate-200 text-slate-700 font-bold text-2xl flex items-center justify-center border border-gray-200">
              {getInitials(member)}
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{member.fullName}</h2>
            {member.nickname ? (
              <p className="text-sm text-gray-500 italic mt-1">{member.nickname}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="p-4 space-y-5">
        {(member.isFounder || member.isExternal) && (
          <section className="flex flex-wrap gap-2">
            {member.isFounder ? (
              <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium px-3 py-1">
                ⭐ מייסד משפחה
              </span>
            ) : null}
            {member.isExternal ? (
              <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1">
                🌍 מחוץ לכפר
              </span>
            ) : null}
            {member.isExternal && member.externalOriginText ? (
              <span className="text-xs text-gray-600 self-center">{member.externalOriginText}</span>
            ) : null}
          </section>
        )}

        <section className="rounded-lg border border-gray-200 p-3">
          <h3 className="text-sm font-bold text-gray-900 mb-2">פרטים אישיים</h3>
          <div className="space-y-1 text-sm text-gray-700">
            <p>
              📅 לידה: <span>{formatDate(member.dateOfBirth)}</span>
            </p>
            <p>
              💀 פטירה:{' '}
              {member.dateOfDeath ? (
                <span>{formatDate(member.dateOfDeath)}</span>
              ) : (
                <span className="text-green-600">בחיים</span>
              )}
            </p>
            <p>
              👤 מגדר: <span>{getGenderLabel(member.gender)}</span>
            </p>
          </div>
        </section>

        {member.bio ? (
          <section className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-sm font-bold text-gray-900 mb-2">ביוגרפיה</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{member.bio}</p>
          </section>
        ) : null}

        {member.externalNotes ? (
          <section className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-sm font-bold text-gray-900 mb-2">הערות</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{member.externalNotes}</p>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
