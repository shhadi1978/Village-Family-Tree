export function formatNumberAr(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDateAr(value: string | Date): string {
  const date = new Date(value);
  
  // Format as dd/mm/yyyy with Latin numerals
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

export function genderLabelAr(value?: string | null): string {
  if (value === "MALE") return "ذكر";
  if (value === "FEMALE") return "أنثى";
  if (value === "OTHER") return "آخر";
  return "غير محدد";
}
