import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts"
import { addDays, daysBetween, fmtDate, parseISO, today } from "@/lib/dates"
import type { WeightPoint } from "@/lib/calc"
import { fmt, niceTicks, num } from "@/lib/utils"

const tick = { fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-sans)", fontWeight: 600 }
const tipStyle = {
  background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 14,
  color: "var(--popover-foreground)", fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-soft)",
}

export function WeightChart({ points, range, goal }: { points: WeightPoint[]; range: number; goal: number | null }) {
  const t = today()
  const rangeStart = range ? addDays(t, -range + 1) : points[0]?.date ?? t
  const pts = points.filter((p) => p.date >= rangeStart)
  if (!pts.length) {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        {points.length ? "No weigh-ins in this period. Pick a longer range." : "No weigh-ins yet. Log one and your trend line starts here."}
      </div>
    )
  }
  const x0 = pts[0].date > rangeStart ? (addDays(pts[0].date, -2) < rangeStart ? rangeStart : addDays(pts[0].date, -2)) : rangeStart
  const span = Math.max(1, daysBetween(x0, t))
  let lo = Math.min(...pts.map((p) => Math.min(p.w, p.t)))
  let hi = Math.max(...pts.map((p) => Math.max(p.w, p.t)))
  const showGoal = num(goal) && goal >= lo - 4 && goal <= hi + 4
  if (showGoal && num(goal)) { lo = Math.min(lo, goal); hi = Math.max(hi, goal) }
  if (hi - lo < 2) { const m = (hi + lo) / 2; lo = m - 1; hi = m + 1 }
  const yt = niceTicks(lo, hi, 5)
  const data = pts.map((p) => ({ x: daysBetween(x0, p.date), w: p.w, t: Math.round(p.t * 10) / 10, date: p.date }))
  const xt = Array.from({ length: 5 }, (_, i) => Math.round((span * i) / 4))
  return (
    <div className="h-[260px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--primary)", stopOpacity: 0.28 }} />
              <stop offset="1" style={{ stopColor: "var(--primary)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis type="number" dataKey="x" domain={[0, span]} ticks={xt} tickFormatter={(v: number) => fmtDate(addDays(x0, v))} tick={tick} axisLine={false} tickLine={false} />
          <YAxis domain={[yt[0], yt[yt.length - 1]]} ticks={yt} tick={tick} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={tipStyle}
            labelFormatter={(v) => fmtDate(addDays(x0, Number(v)), "day")}
            formatter={(v: number, n: string) => [`${fmt(v, 1)} kg`, n === "t" ? "Trend" : "Weigh-in"]}
          />
          {showGoal && num(goal) && (
            <ReferenceLine y={goal} stroke="var(--good)" strokeDasharray="5 4" label={{ value: `Goal ${fmt(goal, 1)} kg`, position: "insideTopLeft", fill: "var(--good)", fontSize: 11, fontWeight: 700 }} />
          )}
          <Area type="monotone" dataKey="t" stroke="var(--primary)" strokeWidth={3} fill="url(#wfill)" dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Scatter dataKey="w" fill="var(--muted-foreground)" fillOpacity={0.55} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BarsChart({
  data, refValue, refLabel, unit, height = 200,
}: {
  data: { label: string; v: number; tone: "acc" | "bad" | "good" | "mute" }[]
  refValue?: number; refLabel?: string; unit: string; height?: number
}) {
  const vmax = Math.max(...data.map((d) => d.v), refValue || 0, 1) * 1.08
  const yt = niceTicks(0, vmax, 4)
  const fill = { acc: "var(--primary)", bad: "var(--bad)", good: "var(--good)", mute: "var(--border)" }
  const shown = data.map((d) => ({ ...d, show: d.v > 0 ? d.v : vmax * 0.012 }))
  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={shown} margin={{ top: 16, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis domain={[0, yt[yt.length - 1]]} ticks={yt} tick={tick} axisLine={false} tickLine={false} width={48} />
          <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.5 }} contentStyle={tipStyle} formatter={(_v, _n, item) => [`${fmt(item.payload.v)} ${unit}`, ""]} separator="" />
          {refValue ? (
            <ReferenceLine y={refValue} stroke="var(--foreground)" strokeOpacity={0.5} strokeDasharray="4 4" label={refLabel ? { value: refLabel, position: "insideTopRight", fill: "var(--foreground)", fontSize: 11, fontWeight: 700 } : undefined} />
          ) : null}
          <Bar dataKey="show" radius={[8, 8, 3, 3]} isAnimationActive={false} maxBarSize={36}>
            {shown.map((d, i) => <Cell key={i} fill={fill[d.tone]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export const dayNum = (d: string) => String(parseISO(d).getDate())
