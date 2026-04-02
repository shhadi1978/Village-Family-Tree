export function formatNumberAr(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDateAr(value: string | Date): string {
  return new Date(value).toLocaleDateString("ar-EG");
}

export function genderLabelAr(value?: string | null): string {
  if (value === "MALE") return "ذكر";
  if (value === "FEMALE") return "أنثى";
  if (value === "OTHER") return "آخر";
  return "غير محدد";
}
