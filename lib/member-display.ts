type MemberNameShape = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  fatherName?: string | null;
  relationshipsAsTo?: Array<{
    type?: string;
    fromMember?: {
      firstName?: string | null;
      fullName?: string | null;
      gender?: string | null;
    } | null;
  }>;
};

function extractFatherGivenName(member: MemberNameShape): string {
  const directFatherName = String(member.fatherName || "").trim();
  if (directFatherName) {
    return directFatherName.split(/\s+/)[0] || "";
  }

  const parentRelations = Array.isArray(member.relationshipsAsTo)
    ? member.relationshipsAsTo
    : [];

  const fatherRelation = parentRelations.find(
    (relation) =>
      relation?.type === "PARENT" &&
      String(relation?.fromMember?.gender || "").toUpperCase() === "MALE"
  );

  const fatherFirstName = String(fatherRelation?.fromMember?.firstName || "").trim();
  if (fatherFirstName) {
    return fatherFirstName;
  }

  const fatherFullName = String(fatherRelation?.fromMember?.fullName || "").trim();
  return fatherFullName ? fatherFullName.split(/\s+/)[0] || "" : "";
}

export function getMemberDisplayName(member?: MemberNameShape | null): string {
  if (!member) {
    return "فرد غير معروف";
  }

  const firstName = String(member.firstName || "").trim();
  const lastName = String(member.lastName || "").trim();
  const fullNameTokens = String(member.fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const resolvedFirstName = firstName || fullNameTokens[0] || "";
  const resolvedLastName =
    lastName ||
    (fullNameTokens.length > 1 ? fullNameTokens[fullNameTokens.length - 1] : "");
  const fatherGivenName = extractFatherGivenName(member);
  const nickname = String(member.nickname || "").trim();

  const orderedName = [resolvedFirstName, fatherGivenName, resolvedLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!orderedName) {
    return nickname ? `(${nickname})` : "فرد غير معروف";
  }

  return nickname ? `${orderedName} (${nickname})` : orderedName;
}

type OptionMember = MemberNameShape & {
  id?: string | null;
  dateOfBirth?: string | Date | null;
  dateOfDeath?: string | Date | null;
};

/**
 * Returns a display label for use in <select> or combobox options.
 * When multiple members share the same display name, appends birth year
 * (and "متوفى" if deceased) to disambiguate them.
 */
export function getMemberOptionLabel(member: OptionMember, allMembers: OptionMember[]): string {
  const baseName = getMemberDisplayName(member);

  const hasDuplicate = allMembers.some(
    (m) => m.id !== member.id && getMemberDisplayName(m) === baseName
  );

  if (!hasDuplicate) {
    return baseName;
  }

  const details: string[] = [];

  if (member.dateOfBirth) {
    details.push(`م. ${new Date(member.dateOfBirth).getFullYear()}`);
  } else {
    details.push("ت.م. غير معروف");
  }

  if (member.dateOfDeath) {
    details.push("متوفى");
  }

  const shortId = String(member.id || "").slice(-6);
  if (shortId) {
    details.push(`id:${shortId}`);
  }

  return `${baseName} (${details.join("، ")})`;
}
