export type OrbState = "idle" | "thinking" | "speaking" | "listening";

export function Orb({ state }: { state: OrbState }) {
  const core = state === "speaking" ? "speaking" : state === "listening" ? "listening" : "";
  return (
    <div className="relative h-[184px] w-[184px]" aria-hidden="true">
      <svg className="jv-ring-a absolute inset-0" width="184" height="184" viewBox="0 0 184 184">
        <circle cx="92" cy="92" r="88" fill="none" stroke="rgb(92 225 255 / .25)" strokeWidth="1" strokeDasharray="1 7" />
        <circle cx="92" cy="92" r="76" fill="none" stroke="rgb(92 225 255 / .55)" strokeWidth="2" strokeDasharray="70 22 8 22" />
      </svg>
      <svg className="jv-ring-b absolute inset-0" width="184" height="184" viewBox="0 0 184 184">
        <circle
          cx="92"
          cy="92"
          r="62"
          fill="none"
          stroke={state === "listening" ? "rgb(75 227 166 / .55)" : "rgb(92 225 255 / .35)"}
          strokeWidth="8"
          strokeDasharray="4 6"
        />
      </svg>
      <div
        className={`orb-core absolute left-[52px] top-[52px] h-20 w-20 rounded-full border-2 bg-[#0B1A24] ${core}`}
        style={{
          borderColor: state === "listening" ? "#4BE3A6" : "#5CE1FF",
          boxShadow:
            state === "listening"
              ? "0 0 28px rgb(75 227 166 / .6), inset 0 0 18px rgb(75 227 166 / .45)"
              : "0 0 28px rgb(92 225 255 / .6), inset 0 0 18px rgb(92 225 255 / .45)",
          opacity: state === "thinking" ? 0.6 : 1,
        }}
      />
    </div>
  );
}
