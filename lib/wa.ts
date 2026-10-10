// Links wa.me (SPEC §4): normaliza dígitos, 55 default.
export function waLink(phone: string, text?: string): string {
  const d = phone.replace(/\D/g, "").replace(/^0+/, "");
  const num = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${num}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
