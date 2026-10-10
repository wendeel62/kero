// Espelho TS de fn_store_is_open (002 l.75–90) — fuso de decisão: America/Manaus (SPEC §2.15).
// open_hours: { "0".."6": [["11:00","23:00"], ...] } — 0=domingo (JS getDay), final inclusivo, máx 3/dia.

type Range = [string, string];

const WEEKDAYS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// dia (0=dom) e minutos do dia no relógio de Manaus, sem libs de data
function manaus(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Manaus",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: DAY_INDEX[get("weekday")] ?? 0, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMin = (t: string) => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

const isHoursObj = (h: unknown): h is Record<string, unknown> =>
  typeof h === "object" && h !== null && !Array.isArray(h); // espelha jsonb_typeof <> 'object'

function dayRanges(hours: Record<string, unknown>, day: number): Range[] {
  const v = hours[day];
  if (!Array.isArray(v)) return [];
  return v.filter((r): r is Range => Array.isArray(r) && typeof r[0] === "string" && typeof r[1] === "string");
}

export function isStoreOpen(hours: unknown, now = new Date()): boolean {
  if (!isHoursObj(hours)) return false;
  const { day, minutes } = manaus(now);
  return dayRanges(hours, day).some(([start, end]) => minutes >= toMin(start) && minutes <= toMin(end));
}

// "Abrimos às HH:MM" se ainda abre hoje; senão "Abrimos segunda às 11:00". {} → "Loja fechada".
// Scan de 8 dias: se todas as aberturas da semana já passaram, cai no mesmo dia da semana seguinte.
export function nextOpeningLabel(hours: unknown, now = new Date()): string {
  if (!isHoursObj(hours)) return "Loja fechada";
  const { day, minutes } = manaus(now);
  for (let i = 0; i <= 7; i++) {
    const d = (day + i) % 7;
    const starts = dayRanges(hours, d)
      .map(([start]) => start)
      .filter((s) => i === 0 ? toMin(s) > minutes : true);
    if (starts.length > 0) {
      const at = starts.reduce((a, b) => (toMin(b) < toMin(a) ? b : a));
      return i === 0 ? `Abrimos às ${at}` : `Abrimos ${WEEKDAYS_PT[d]} às ${at}`;
    }
  }
  return "Loja fechada";
}
