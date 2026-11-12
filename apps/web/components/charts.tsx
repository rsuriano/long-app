import { pathD, toPoints } from "@/lib/series";

export function Sparkline({ vals, cls }: { vals: number[]; cls: "up" | "down" }) {
  const w = 64, h = 28;
  const pts = toPoints(vals, w, h, 6, 3);
  const last = pts[pts.length - 1] ?? [0, 0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" preserveAspectRatio="none">
      <path d={pathD(pts)} fill="none" stroke={`var(--${cls})`} strokeWidth="2" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={`var(--${cls})`} />
    </svg>
  );
}

export function AreaChart({ vals, cls }: { vals: number[]; cls: "up" | "down" }) {
  const w = 300, h = 90;
  const pts = toPoints(vals, w, h, 14, 6);
  const d = pathD(pts);
  const last = pts[pts.length - 1] ?? [0, 0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={`var(--${cls})`} stopOpacity=".28" />
          <stop offset="1" stopColor={`var(--${cls})`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w} ${h} L0 ${h}Z`} fill="url(#g)" />
      <path d={d} fill="none" stroke={`var(--${cls})`} strokeWidth="2" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={`var(--${cls})`} />
    </svg>
  );
}
