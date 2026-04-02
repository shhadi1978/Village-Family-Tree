import { getMemberDisplayName } from "@/lib/member-display";
import { isFamilyFounder } from "@/lib/member-founder";

type ParentRelation = {
  type?: string;
  fromMember?: {
    id?: string | null;
    gender?: string | null;
  } | null;
};

type SortableMember = {
  id: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | Date | null;
  createdAt?: string | Date | null;
  gender?: string | null;
  isFounder?: boolean | null;
  relationshipsAsTo?: ParentRelation[];
};

function toTime(value?: string | Date | null): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function compareByBirthThenSequence(a: SortableMember, b: SortableMember): number {
  const byBirth = toTime(a.dateOfBirth) - toTime(b.dateOfBirth);
  if (byBirth !== 0) {
    return byBirth;
  }

  const byCreated = toTime(a.createdAt) - toTime(b.createdAt);
  if (byCreated !== 0) {
    return byCreated;
  }

  return getMemberDisplayName(a).localeCompare(getMemberDisplayName(b), "ar");
}

function getFatherId(member: SortableMember): string | null {
  const relations = Array.isArray(member.relationshipsAsTo)
    ? member.relationshipsAsTo
    : [];

  const fatherRelation = relations.find(
    (relation) =>
      relation?.type === "PARENT" &&
      String(relation?.fromMember?.gender || "").toUpperCase() === "MALE"
  );

  const fatherId = String(fatherRelation?.fromMember?.id || "").trim();
  return fatherId || null;
}

export function sortMembersByLineage<T extends SortableMember>(
  list: T[],
  familyName?: string | null
): T[] {
  const members = Array.isArray(list) ? [...list] : [];
  if (members.length <= 1) {
    return members;
  }

  const byId = new Map<string, T>();
  members.forEach((member) => {
    byId.set(member.id, member);
  });

  const childrenByFather = new Map<string, T[]>();
  const roots: T[] = [];

  for (const member of members) {
    const fatherId = getFatherId(member);

    if (!fatherId || !byId.has(fatherId)) {
      roots.push(member);
      continue;
    }

    const siblings = childrenByFather.get(fatherId) || [];
    siblings.push(member);
    childrenByFather.set(fatherId, siblings);
  }

  for (const [, siblings] of childrenByFather) {
    siblings.sort(compareByBirthThenSequence);
  }

  roots.sort((a, b) => {
    const founderA = isFamilyFounder(a, familyName);
    const founderB = isFamilyFounder(b, familyName);

    if (founderA && !founderB) {
      return -1;
    }

    if (!founderA && founderB) {
      return 1;
    }

    return compareByBirthThenSequence(a, b);
  });

  const ordered: T[] = [];
  const visited = new Set<string>();

  const visit = (member: T) => {
    if (visited.has(member.id)) {
      return;
    }

    visited.add(member.id);
    ordered.push(member);

    const children = childrenByFather.get(member.id) || [];
    for (const child of children) {
      visit(child);
    }
  };

  for (const root of roots) {
    visit(root);
  }

  const leftovers = members
    .filter((member) => !visited.has(member.id))
    .sort(compareByBirthThenSequence);

  return [...ordered, ...leftovers];
}
