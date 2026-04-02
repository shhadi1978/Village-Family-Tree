type MemberGender = "MALE" | "FEMALE" | "OTHER" | string;

type ParentRelation = {
  type?: string;
  fromMember?: {
    id?: string | null;
    gender?: string | null;
  } | null;
};

type MemberForLineage = {
  id: string;
  gender?: MemberGender | null;
  relationshipsAsTo?: ParentRelation[];
};

export type LineageStats = {
  total: number;
  male: number;
  female: number;
  other: number;
};

function getFatherId(member: MemberForLineage): string | null {
  const relations = Array.isArray(member.relationshipsAsTo)
    ? member.relationshipsAsTo
    : [];

  const fatherRelation = relations.find(
    (relation) =>
      relation?.type === "PARENT" &&
      String(relation?.fromMember?.gender || "").toUpperCase() === "MALE"
  );

  const id = String(fatherRelation?.fromMember?.id || "").trim();
  return id || null;
}

export function buildLineageStatsByMember<T extends MemberForLineage>(
  members: T[]
): Map<string, LineageStats> {
  const list = Array.isArray(members) ? members : [];
  const byId = new Map<string, T>();
  const childrenByFather = new Map<string, string[]>();

  for (const member of list) {
    byId.set(member.id, member);
  }

  for (const member of list) {
    const fatherId = getFatherId(member);
    if (!fatherId || !byId.has(fatherId)) {
      continue;
    }

    const children = childrenByFather.get(fatherId) || [];
    children.push(member.id);
    childrenByFather.set(fatherId, children);
  }

  const memo = new Map<string, LineageStats>();

  const dfs = (memberId: string, visiting: Set<string>): LineageStats => {
    const cached = memo.get(memberId);
    if (cached) {
      return cached;
    }

    if (visiting.has(memberId)) {
      return { total: 0, male: 0, female: 0, other: 0 };
    }

    visiting.add(memberId);

    let total = 0;
    let male = 0;
    let female = 0;
    let other = 0;

    const children = childrenByFather.get(memberId) || [];
    for (const childId of children) {
      const child = byId.get(childId);
      if (!child) {
        continue;
      }

      total += 1;
      const gender = String(child.gender || "").toUpperCase();
      if (gender === "MALE") {
        male += 1;
      } else if (gender === "FEMALE") {
        female += 1;
      } else {
        other += 1;
      }

      const childStats = dfs(childId, visiting);
      total += childStats.total;
      male += childStats.male;
      female += childStats.female;
      other += childStats.other;
    }

    visiting.delete(memberId);

    const stats = { total, male, female, other };
    memo.set(memberId, stats);
    return stats;
  };

  for (const member of list) {
    dfs(member.id, new Set<string>());
  }

  return memo;
}
