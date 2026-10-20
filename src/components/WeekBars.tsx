import type { DayBar } from "@/lib/stats";
import { fmtHours } from "@/lib/time";

const HEIGHT = 120;

export function WeekBars({ bars, targetH }: { bars: DayBar[]; targetH: number }) {
  const max = Math.max(targetH * 1.6, ...bars.map((b) => b.hours), 1);
  const y = (h: number) => Math.round((h / max) * HEIGHT);
  return (
    <div>
      <div className="relative grid grid-cols-7 items-end gap-2.5" style={{ height: HEIGHT }}>
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-amber/70"
          style={{ bottom: y(targetH) }}
        />
        <div className="absolute right-0 font-mono text-[10.5px] text-amber" style={{ bottom: y(targetH) + 4 }}>
          {fmtHours(targetH)}
        </div>
        {bars.map((b) => {
          const ok = b.hours >= targetH;
          return (
            <div
              key={b.day}
              title={`${b.label} : ${fmtHours(b.hours)}`}
              aria-label={`${b.label} : ${fmtHours(b.hours)}`}
              className="rounded-t-md rounded-b-sm"
              style={{
                height: Math.max(2, y(b.hours)),
                background: b.isToday
                  ? "repeating-linear-gradient(135deg, rgb(92 225 255 / .6) 0 4px, rgb(92 225 255 / .22) 4px 8px)"
                  : ok
                    ? "#5CE1FF"
                    : "rgb(92 225 255 / .38)",
                transition: "height .6s ease",
              }}
            />
          );
        })}
      </div>
      <div className="mt-2.5 grid grid-cols-7 gap-2.5">
        {bars.map((b) => (
          <div key={b.day} className={`text-center font-mono text-[10.5px] ${b.isToday ? "text-cyan" : "text-muted"}`}>
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
