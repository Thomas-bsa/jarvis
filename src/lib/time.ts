// Every "day" in Jarvis is a day in Paris time, whatever the server's clock says.
export const TZ = "Europe/Paris";

/** "YYYY-MM-DD" for the Paris day that contains this instant. */
export function parisDay(d: Date | string = new Date()): string {
  return new Date(d).toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** "HH:MM" in Paris time. */
export function parisTime(d: Date | string = new Date()): string {
  return new Date(d).toLocaleTimeString("fr-FR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Shift a "YYYY-MM-DD" day by n days. */
export function addDays(day: string, n: number): string {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: string): number {
  return (new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7;
}

export function mondayOf(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

const SHORT = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
export function shortWeekday(day: string): string {
  return SHORT[weekdayIndex(day)];
}

/** "mardi 20 octobre" */
export function longDate(d: Date = new Date()): string {
  return d.toLocaleDateString("fr-FR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** 190 → "3 h 10", 45 → "45 min", 120 → "2 h" */
export function fmtMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  const nb = "\u00a0"; // keep "3 h 10" on one line
  if (h === 0) return `${r}${nb}min`;
  if (r === 0) return `${h}${nb}h`;
  return `${h}${nb}h${nb}${String(r).padStart(2, "0")}`;
}

/** 7.5 → "7 h 30" */
export function fmtHours(h: number): string {
  return fmtMinutes(h * 60);
}

/** Paris greeting for the hour. */
export function greeting(d: Date = new Date()): string {
  const h = Number(
    d.toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", hour12: false })
  );
  if (h >= 5 && h < 18) return "Bonjour";
  return "Bonsoir";
}
