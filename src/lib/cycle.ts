/* Menstrual-cycle calculations.
 * Recorded periods are facts. Everything else (future periods, phases) is an estimate and is flagged as such.
 * No cycle length is assumed: it comes from the settings, or from the person's own recorded cycles.
 */
import type { Period, Profile } from "./types"
import type { WeightPoint } from "./calc"
import { addDays, daysBetween, today } from "./dates"
import { mean, num, slope } from "./utils"

export type Phase = "menstrual" | "follicular" | "ovulatory" | "luteal"
export const PHASES: [Phase, string, string][] = [
  ["menstrual", "Period", "Bleeding days"],
  ["follicular", "Follicular", "From the period to ovulation"],
  ["ovulatory", "Ovulation window", "Estimated, about 14 days before the next period"],
  ["luteal", "Luteal", "From ovulation to the next period"],
]
export const PHASE_COLOR: Record<Phase, string> = {
  menstrual: "var(--period)", follicular: "var(--fiber)", ovulatory: "var(--carbs)", luteal: "var(--fat)",
}
export const phaseName = (p: Phase) => (PHASES.find((x) => x[0] === p) || PHASES[0])[1]

/** Cycles shorter or longer than this are treated as a missed record, not a real cycle length. */
const MIN_CYCLE = 15
const MAX_CYCLE = 60
/** If an ongoing period has no end after this many days, only its start day is shown as recorded. */
const OPEN_PERIOD_MAX = 10

const median = (a: number[]) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface CycleStats {
  cycleLen: number | null; cycleSource: "settings" | "records" | null
  periodLen: number | null; periodSource: "settings" | "records" | null
  observed: number[]
}
export interface Range { start: string; end: string }
export interface CycleCtx {
  periods: Period[]
  /** Recorded bleeding days, start to end (an ongoing period runs to today). */
  recorded: (Range & { id: string; open: boolean })[]
  /** Predicted periods, next 3 cycles (and any expected one that has not been recorded yet). */
  predicted: Range[]
  stats: CycleStats
}

export function sortPeriods(map: Record<string, Period>) {
  return Object.values(map).filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.start)).sort((a, b) => (a.start < b.start ? -1 : 1))
}

function recordedEnd(p: Period, t: string) {
  if (p.end && p.end >= p.start) return p.end
  const days = daysBetween(p.start, t)
  return days >= 0 && days < OPEN_PERIOD_MAX ? t : p.start
}

export function cycleStats(periods: Period[], prof: Pick<Profile, "cycleLength" | "periodLength">): CycleStats {
  const observed: number[] = []
  for (let i = 1; i < periods.length; i++) {
    const d = daysBetween(periods[i - 1].start, periods[i].start)
    if (d >= MIN_CYCLE && d <= MAX_CYCLE) observed.push(d)
  }
  const durations = periods.filter((p) => p.end && p.end >= p.start).map((p) => daysBetween(p.start, p.end as string) + 1).filter((d) => d <= 14)
  const recCycle = median(observed.slice(-6))
  const recPeriod = median(durations.slice(-6))
  const cycleLen = num(prof.cycleLength) ? prof.cycleLength : recCycle != null ? Math.round(recCycle) : null
  const periodLen = num(prof.periodLength) ? prof.periodLength : recPeriod != null ? Math.round(recPeriod) : null
  return {
    cycleLen, cycleSource: num(prof.cycleLength) ? "settings" : recCycle != null ? "records" : null,
    periodLen, periodSource: num(prof.periodLength) ? "settings" : recPeriod != null ? "records" : null,
    observed,
  }
}

export function cycleContext(map: Record<string, Period>, prof: Pick<Profile, "cycleLength" | "periodLength">, t = today()): CycleCtx {
  const periods = sortPeriods(map)
  const stats = cycleStats(periods, prof)
  const recorded = periods.map((p) => ({ id: p.id, start: p.start, end: recordedEnd(p, t), open: !p.end }))
  const predicted: Range[] = []
  const last = periods[periods.length - 1]
  if (last && stats.cycleLen) {
    const len = stats.cycleLen
    const pl = Math.max(1, stats.periodLen ?? 1)
    let start = addDays(last.start, len)
    // Skip predictions that are more than one cycle in the past: the records are simply missing.
    while (daysBetween(start, t) > len) start = addDays(start, len)
    for (let i = 0; i < 3; i++) {
      predicted.push({ start, end: addDays(start, pl - 1) })
      start = addDays(start, len)
    }
  }
  return { periods, recorded, predicted, stats }
}

export interface DayInfo {
  /** Bleeding recorded on this day. */
  recorded: boolean
  /** A predicted period day (never true on a recorded day). */
  predictedPeriod: boolean
  /** Estimated phase, or null when it cannot be estimated. Always an estimate except on recorded period days. */
  phase: Phase | null
  cycleDay: number | null
  /** The cycle this day belongs to started on a predicted (not recorded) date. */
  fromPrediction: boolean
}

export function dayInfo(ctx: CycleCtx, d: string): DayInfo {
  const out: DayInfo = { recorded: false, predictedPeriod: false, phase: null, cycleDay: null, fromPrediction: false }
  const rec = ctx.recorded.find((r) => d >= r.start && d <= r.end)
  if (rec) out.recorded = true
  // The cycle this date belongs to: the latest recorded start on or before it, or a later predicted one.
  let base: { start: string; len: number | null; pLen: number | null; predicted: boolean } | null = null
  for (let i = ctx.recorded.length - 1; i >= 0; i--) {
    const r = ctx.recorded[i]
    if (r.start <= d) {
      const next = ctx.recorded[i + 1]
      const gap = next ? daysBetween(r.start, next.start) : null
      const len = gap != null && gap >= MIN_CYCLE && gap <= MAX_CYCLE ? gap : ctx.stats.cycleLen
      const pLen = r.open ? (r.end > r.start ? daysBetween(r.start, r.end) + 1 : ctx.stats.periodLen) : daysBetween(r.start, r.end) + 1
      base = { start: r.start, len, pLen, predicted: false }
      break
    }
  }
  const lastRec = ctx.recorded[ctx.recorded.length - 1]
  for (let i = ctx.predicted.length - 1; i >= 0; i--) {
    const p = ctx.predicted[i]
    if (p.start <= d && (!lastRec || p.start > lastRec.start)) {
      if (!base || p.start > base.start) base = { start: p.start, len: ctx.stats.cycleLen, pLen: ctx.stats.periodLen, predicted: true }
      break
    }
  }
  if (!out.recorded) out.predictedPeriod = ctx.predicted.some((p) => d >= p.start && d <= p.end)
  if (!base) return out
  const cd = daysBetween(base.start, d) + 1
  out.fromPrediction = base.predicted
  if (base.len != null && cd > base.len + 7) return out // far past the expected next period: unknown
  out.cycleDay = cd
  if (out.recorded || (base.pLen != null && cd <= base.pLen)) { out.phase = "menstrual"; return out }
  if (base.len == null) return out
  const ov = Math.max((base.pLen ?? 1) + 2, base.len - 14)
  out.phase = cd < ov - 1 ? "follicular" : cd <= ov + 1 ? "ovulatory" : "luteal"
  return out
}

/** Consecutive days with the same estimated phase, for chart overlays. */
export function phaseSegments(ctx: CycleCtx, from: string, to: string) {
  const segs: { start: string; end: string; phase: Phase }[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const ph = dayInfo(ctx, d).phase
    const lastSeg = segs[segs.length - 1]
    if (ph && lastSeg && lastSeg.phase === ph && lastSeg.end === addDays(d, -1)) lastSeg.end = d
    else if (ph) segs.push({ start: d, end: d, phase: ph })
  }
  return segs
}

/** Days when water retention is most common: the 5 days before a recorded period and its first 3 days. */
export function inRetentionWindow(ctx: CycleCtx, d: string) {
  return ctx.recorded.some((r) => d >= addDays(r.start, -5) && d <= addDays(r.start, 2))
    || ctx.predicted.some((p) => d >= addDays(p.start, -5) && d <= addDays(p.start, 2))
}

/* ---------- weight across cycles ---------- */
export interface CycleWeight {
  start: string; end: string; len: number; complete: boolean
  n: number; avg: number | null; min: number | null; max: number | null
  /** Weigh-ins by cycle day, as recorded and as difference from this cycle's average. */
  pts: { day: number; w: number; dev: number }[]
}
export function weightByCycle(ctx: CycleCtx, points: WeightPoint[], t = today()): CycleWeight[] {
  return ctx.recorded.map((r, i) => {
    const next = ctx.recorded[i + 1]
    const end = next ? addDays(next.start, -1) : t
    const ws = points.filter((p) => p.date >= r.start && p.date <= end)
    const avg = ws.length ? mean(ws.map((p) => p.w)) : null
    return {
      start: r.start, end, len: daysBetween(r.start, end) + 1, complete: !!next, n: ws.length, avg,
      min: ws.length ? Math.min(...ws.map((p) => p.w)) : null,
      max: ws.length ? Math.max(...ws.map((p) => p.w)) : null,
      pts: ws.map((p) => ({ day: daysBetween(r.start, p.date) + 1, w: p.w, dev: p.w - (avg as number) })),
    }
  })
}

/** Average difference between weigh-ins in the retention window and the rest of the same cycles.
 *  Measured around a straight line fitted through each cycle, so ongoing loss or gain does not bias it. */
export function typicalSwing(ctx: CycleCtx, points: WeightPoint[]) {
  const diffs: number[] = []
  for (let i = 1; i < ctx.recorded.length; i++) {
    const r = ctx.recorded[i]
    const prevStart = ctx.recorded[i - 1].start
    const from = addDays(r.start, -5)
    const to = addDays(r.start, 2)
    const ws = points.filter((p) => p.date > addDays(prevStart, 2) && p.date <= to)
    const near = ws.filter((p) => p.date >= from)
    const rest = ws.filter((p) => p.date < from)
    if (near.length < 2 || rest.length < 3) continue
    const xy = rest.map((p) => [daysBetween(prevStart, p.date), p.w] as [number, number])
    const b = slope(xy)
    const a = mean(xy.map((q) => q[1])) - b * mean(xy.map((q) => q[0]))
    const fit = (d: string) => a + b * daysBetween(prevStart, d)
    diffs.push(mean(near.map((p) => p.w - fit(p.date))))
  }
  return diffs.length ? { kg: mean(diffs), cycles: diffs.length } : null
}
