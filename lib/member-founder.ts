type FounderCandidate = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  isFounder?: boolean | null;
  fatherName?: string | null;
  relationshipsAsTo?: Array<{
    type?: string | null;
    fromMember?: {
      gender?: string | null;
    } | null;
  }>;
};

function hasFather(member: FounderCandidate): boolean {
  const directFatherName = String(member.fatherName || "").trim();
  if (directFatherName) {
    return true;
  }

  const incomingRelations = Array.isArray(member.relationshipsAsTo)
    ? member.relationshipsAsTo
    : [];

  return incomingRelations.some(
    (relation) =>
      relation?.type === "PARENT" &&
      String(relation?.fromMember?.gender || "").toUpperCase() === "MALE"
  );
}

export function isFamilyFounder(member?: FounderCandidate | null, familyName?: string | null): boolean {
  if (!member) {
    return false;
  }

  if (hasFather(member)) {
    return false;
  }

  if (member.isFounder === true) {
    return true;
  }

  const normalizedFamily = String(familyName || "").trim().toLowerCase();
  const normalizedMember = String(member.fullName || "").trim().toLowerCase();
  const normalizedFirst = String(member.firstName || "").trim().toLowerCase();
  const normalizedLast = String(member.lastName || "").trim().toLowerCase();
  const normalizedGender = String(member.gender || "").trim().toUpperCase();

  if (!normalizedFamily) {
    return false;
  }

  if (normalizedGender !== "MALE") {
    return false;
  }

  // Founder creation may store family name in first/last (e.g., "العائلة العائلة").
  return (
    normalizedMember === normalizedFamily ||
    normalizedFirst === normalizedFamily ||
    normalizedLast === normalizedFamily ||
    (normalizedFirst === normalizedFamily && normalizedLast === normalizedFamily)
  );
}
