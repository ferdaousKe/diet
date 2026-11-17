import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts"
import { addDays, daysBetween, fmtDate, parseISO, today } from "@/lib/dates"
import { planWeight, type Plan, type WeightPoint } from "@/lib/calc"
import { PHASE_COLOR, phaseName, phaseSegments, type CycleCtx, type CycleWeight } from "@/lib/cycle"
import { fmt, niceTicks, num } from "@/lib/utils"

const tick = { fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-sans)", fontWeight: 600 }
const tipStyle = {
  background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 14,
  color: "var(--popover-foreground)", fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-soft)",
}

export function WeightChart({ points, range, goal, cyc, showPhases, show7 = true, plan }: {
  points: WeightPoint[]; range: number; goal: number | null
  /** Recorded periods are drawn as bands; estimated phases only when `showPhases`. */
  cyc?: CycleCtx | null; showPhases?: boolean; show7?: boolean; plan?: Plan | null
}) {
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
  // Plan line: from the reference date (or the left edge) to today.
  const planFrom = plan && plan.start <= t ? (plan.start > x0 ? plan.start : x0) : null
  const planSeg = plan && planFrom ? [{ x: daysBetween(x0, planFrom), y: planWeight(plan, planFrom) }, { x: span, y: planWeight(plan, t) }] : null
  if (planSeg) { lo = Math.min(lo, planSeg[1].y); hi = Math.max(hi, planSeg[0].y) }
  if (hi - lo < 2) { const m = (hi + lo) / 2; lo = m - 1; hi = m + 1 }
  const yt = niceTicks(lo, hi, 5)
  const data = pts.map((p) => ({ x: daysBetween(x0, p.date), w: p.w, t: Math.round(p.t * 10) / 10, a7: Math.round(p.a7 * 100) / 100, date: p.date }))
  // Day ranges as chart x positions, clamped to the visible window (areas outside the domain are not drawn).
  const band = (a: string, b: string) => {
    const x1 = Math.max(0, daysBetween(x0, a))
    const x2 = Math.min(span, daysBetween(x0, b) + 1)
    return x2 > x1 ? { x1, x2 } : null
  }
  const periodBands = (cyc?.recorded || []).map((r) => band(r.start, r.end)).filter(Boolean) as { x1: number; x2: number }[]
  const phaseBands = showPhases && cyc
    ? phaseSegments(cyc, x0, t).filter((g) => g.phase !== "menstrual").map((g) => ({ ...band(g.start, g.end), phase: g.phase })).filter((g) => g.x1 != null)
    : []
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
            formatter={(v: number, n: string) => [`${fmt(v, n === "a7" ? 2 : 1)} kg`, n === "t" ? "Trend" : n === "a7" ? "7-day average" : "Weigh-in"]}
          />
          {phaseBands.map((g, i) => (
            <ReferenceArea key={"ph" + i} x1={g.x1} x2={g.x2} fill={PHASE_COLOR[g.phase]} fillOpacity={0.09} stroke="none" ifOverflow="hidden">
              <title>{`Estimated ${phaseName(g.phase).toLowerCase()} phase`}</title>
            </ReferenceArea>
          ))}
          {periodBands.map((b, i) => (
            <ReferenceArea key={"pe" + i} x1={b.x1} x2={b.x2} fill="var(--period)" fillOpacity={0.16} stroke="var(--period)" strokeOpacity={0.35} ifOverflow="hidden"
              label={{ value: "P", position: "insideTop", fill: "var(--period)", fontSize: 10, fontWeight: 800 }} />
          ))}
          {planSeg && (
            <ReferenceLine segment={planSeg} stroke="var(--foreground)" strokeOpacity={0.45} strokeDasharray="2 5" strokeWidth={2} ifOverflow="hidden" />
          )}
          {showGoal && num(goal) && (
            <ReferenceLine y={goal} stroke="var(--good)" strokeDasharray="5 4" label={{ value: `Goal ${fmt(goal, 1)} kg`, position: "insideTopLeft", fill: "var(--good)", fontSize: 11, fontWeight: 700 }} />
          )}
          <Area type="monotone" dataKey="t" stroke="var(--primary)" strokeWidth={3} fill="url(#wfill)" dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
          {show7 && <Line type="monotone" dataKey="a7" stroke="var(--plum)" strokeWidth={1.75} strokeDasharray="6 3" dot={false} isAnimationActive={false} />}
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

const CYCLE_COLORS = ["var(--primary)", "var(--fat)", "var(--fiber)", "var(--carbs)"]
/** Each cycle's weigh-ins by cycle day, as the difference from that cycle's own average weight. */
export function CycleOverlayChart({ cycles }: { cycles: CycleWeight[] }) {
  const shown = cycles.filter((c) => c.pts.length >= 3).slice(-4)
  if (shown.length < 1) return null
  const maxDay = Math.max(...shown.map((c) => c.len), 28)
  const devs = shown.flatMap((c) => c.pts.map((p) => p.dev))
  const m = Math.max(0.6, ...devs.map(Math.abs))
  const yt = niceTicks(-m, m, 5)
  return (
    <div className="h-[220px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis type="number" dataKey="day" domain={[1, maxDay]} tick={tick} axisLine={false} tickLine={false} allowDuplicatedCategory={false} tickFormatter={(v: number) => `D${v}`} />
          <YAxis domain={[yt[0], yt[yt.length - 1]]} ticks={yt} tick={tick} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => (v > 0 ? "+" : "") + fmt(v, 1)} />
          <ReferenceLine y={0} stroke="var(--foreground)" strokeOpacity={0.35} />
          <Tooltip contentStyle={tipStyle} labelFormatter={(v) => `Cycle day ${v}`} formatter={(v: number, n: string) => [`${v > 0 ? "+" : ""}${fmt(v, 2)} kg vs. cycle average`, n]} />
          {shown.map((c, i) => (
            <Line key={c.start} data={c.pts} dataKey="dev" name={`Cycle from ${fmtDate(c.start)}`} type="monotone" stroke={CYCLE_COLORS[i % CYCLE_COLORS.length]} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
