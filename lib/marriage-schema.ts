export function isMarriageSchemaRuntimeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");

  return (
    message.includes("Relationship.marriageId") ||
    message.includes("Marriage") ||
    message.includes("P2021") ||
    message.includes("P2022")
  );
}