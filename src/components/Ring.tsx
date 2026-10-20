type Props = {
  label: string;
  value: string;
  target: string;
  pct: number; // 0..1+
  color: string;
};

const R = 38;
const C = 2 * Math.PI * R;

export function Ring({ label, value, target, pct, color }: Props) {
  const p = Math.max(0, Math.min(1, pct));
  const done = pct >= 1;
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative h-[88px] w-[88px]">
        <svg
          width="88"
          height="88"
          viewBox="0 0 88 88"
          role="img"
          aria-label={`${label} : ${value} sur ${target}`}
          className="-rotate-90"
        >
          <circle cx="44" cy="44" r={R} fill="none" stroke="#18222E" strokeWidth="5" />
          <circle
            cx="44"
            cy="44"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${(C * p).toFixed(1)} ${C.toFixed(1)}`}
            style={{ transition: "stroke-dasharray .8s ease", filter: done ? `drop-shadow(0 0 6px ${color})` : undefined }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[19px] font-semibold tracking-tight">{value}</div>
          <div className="font-mono text-[10.5px] text-muted">/ {target}</div>
        </div>
      </div>
      <div className="text-[13px] text-ink-2">{label}</div>
    </div>
  );
}
