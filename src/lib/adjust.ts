/* Calorie check-in: compares 3–4 weeks of real progress with the plan and may suggest a small change.
 * It never changes anything by itself: applying a suggestion is a separate, confirmed action.
 */
import type { Day, DayType, Profile } from "./types"
import { dayTarget, dayTotals, dayTypeOf, targetsOf, type Metrics } from "./calc"
import { inRetentionWindow, type CycleCtx } from "./cycle"
import { addDays, daysBetween, today } from "./dates"
import { mean, num, slope } from "./utils"

export const CHECK = {
  minDays: 21,        // window length needed (3 weeks), up to 28
  maxDays: 28,
  completeShare: 0.75, // share of days with a complete food log
  minWeighIns: 8,
  minSpan: 18,        // days between first and last weigh-in
  threshold: 0.15,    // kg/week away from the target pace before anything is suggested
  step: 50, maxStep: 150, minStep: 50,
  overEating: 100,    // kcal/day above target: adherence first, no target change
  floor: 1200,
}

export interface Check {
  status: "learning" | "on-track" | "suggest" | "hold" | "snoozed"
  windowStart: string; windowEnd: string; windowDays: number
  completeDays: number; weighIns: number; span: number
  needComplete: number
  /** kg/week, negative = losing. */
  actualRate?: number
  targetRate: number
  avgIntake?: number; avgTarget?: number
  trainingPerWeek?: number; trainingChange?: number
  cycleAware: boolean; excludedReadings: number
  halves?: [number, number]
  delta?: number
  message: string
  notes: string[]
}

const isComplete = (d: Day | undefined, targetK: number) => !!d && dayTotals(d).k >= Math.max(800, targetK * 0.5)

export function calorieCheck(days: Record<string, Day>, p: Profile, M: Metrics, cyc: CycleCtx, t = today()): Check {
  const end = addDays(t, -1) // today is not finished yet
  const lastAdj = p.adjustments?.length ? p.adjustments[p.adjustments.length - 1].date : null
  let start = addDays(end, -(CHECK.maxDays - 1))
  if (lastAdj && lastAdj >= start) start = addDays(lastAdj, 1)
  const windowDays = Math.max(0, daysBetween(start, end) + 1)
  const sign = p.goal === "gain" ? 1 : p.goal === "lose" ? -1 : 0
  const targetRate = sign * (num(p.rate) ? p.rate : 0)

  const dates: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d)
  const targets = dates.map((d) => dayTarget(p, M, days[d]).k)
  const complete = dates.filter((d, i) => isComplete(days[d], targets[i]))
  const ws = dates.filter((d) => num(days[d]?.weight)).map((d) => ({ date: d, w: days[d].weight as number }))
  const span = ws.length > 1 ? daysBetween(ws[0].date, ws[ws.length - 1].date) : 0
  const needComplete = Math.ceil(Math.max(windowDays, CHECK.minDays) * CHECK.completeShare)
  const base: Check = {
    status: "learning", windowStart: start, windowEnd: end, windowDays, completeDays: complete.length, weighIns: ws.length, span,
    needComplete, targetRate, cycleAware: false, excludedReadings: 0, message: "", notes: [],
  }

  if (p.adjSnoozeUntil && p.adjSnoozeUntil > t) {
    return { ...base, status: "snoozed", message: `Hidden until ${p.adjSnoozeUntil}.` }
  }
  if (windowDays < CHECK.minDays || complete.length < needComplete || ws.length < CHECK.minWeighIns || span < CHECK.minSpan) {
    base.message = lastAdj && daysBetween(lastAdj, t) < CHECK.minDays
      ? "Your last calorie change needs at least 3 weeks before it can be judged."
      : "A check needs at least 3 weeks with mostly complete food logs and regular weigh-ins."
    return base
  }

  // Weekly rate from a least-squares line through the weigh-ins (a smoothed trend, not one reading).
  // Readings from the days around a period are left out when cycles are recorded: they are often
  // raised by water retention. The readings themselves are not changed.
  let used = ws
  if (cyc.recorded.length) {
    const kept = ws.filter((x) => !inRetentionWindow(cyc, x.date))
    if (kept.length >= 6 && daysBetween(kept[0].date, kept[kept.length - 1].date) >= 14) {
      base.excludedReadings = ws.length - kept.length
      base.cycleAware = base.excludedReadings > 0
      used = kept
    }
  }
  const rateOf = (arr: { date: string; w: number }[]) => slope(arr.map((x) => [daysBetween(start, x.date), x.w] as [number, number])) * 7
  const actual = rateOf(used)
  const mid = addDays(start, Math.floor(windowDays / 2))
  const h1 = used.filter((x) => x.date < mid)
  const h2 = used.filter((x) => x.date >= mid)
  const halves: [number, number] | undefined = h1.length >= 3 && h2.length >= 3 ? [rateOf(h1), rateOf(h2)] : undefined

  const intake = complete.map((d) => dayTotals(days[d]).k)
  const avgIntake = mean(intake)
  const avgTarget = mean(complete.map((d) => targets[dates.indexOf(d)]))

  const isTraining = (d: string) => dayTypeOf(days[d], p).type !== "rest"
  const tr1 = dates.filter((d) => d < mid).filter(isTraining).length / (Math.max(1, daysBetween(start, mid)) / 7)
  const tr2 = dates.filter((d) => d >= mid).filter(isTraining).length / (Math.max(1, daysBetween(mid, end) + 1) / 7)
  const trainingPerWeek = dates.filter(isTraining).length / (windowDays / 7)

  Object.assign(base, { actualRate: actual, halves, avgIntake, avgTarget, trainingPerWeek, trainingChange: tr2 - tr1 })

  // Positive gap = slower than planned toward the goal (for loss: losing less than the target pace).
  const gap = sign < 0 ? actual - targetRate : sign > 0 ? targetRate - actual : Math.abs(actual)
  const halfGap = halves ? halves.map((h) => (sign < 0 ? h - targetRate : sign > 0 ? targetRate - h : 0)) : null
  if (Math.abs(gap) < CHECK.threshold) {
    base.status = "on-track"
    base.message = "Your progress matches your plan. No change needed."
    return base
  }
  const consistent = halfGap != null && halfGap.every((g) => Math.sign(g) === Math.sign(gap) && Math.abs(g) >= CHECK.threshold / 2)
  if (!consistent) {
    base.status = "hold"
    base.message = "The trend differs from your plan, but not consistently across the weeks. Keep going for another week or two before changing anything."
    return base
  }
  if (gap > 0 && avgIntake > avgTarget + CHECK.overEating) {
    base.status = "hold"
    base.message = `On complete days you ate about ${Math.round(avgIntake - avgTarget)} kcal a day above your target. Reaching the current target is the first step; lowering it is not suggested.`
    return base
  }
  if (gap > 0 && base.trainingChange != null && base.trainingChange <= -1) {
    base.notes.push("You trained about one day a week less in the second half of this period. Part of the slowdown may come from that.")
  }
  if (sign === 0) {
    base.status = "hold"
    base.message = "Your goal is to maintain. Your weight moved a little; keep an eye on it."
    return base
  }
  // Half the energy gap, rounded and capped: small steps, then re-check after 3 weeks.
  const kcalGap = (Math.abs(gap) * 7700) / 7
  let step = Math.min(CHECK.maxStep, Math.max(CHECK.minStep, Math.round((kcalGap / 2) / CHECK.step) * CHECK.step))
  const lowerCalories = (sign < 0 && gap > 0) || (sign > 0 && gap < 0)
  if (lowerCalories) {
    const lowest = Math.min(...(["rest", "gym", "run"] as DayType[]).map((x) => targetsOf(p, x).k))
    const room = M.mode === "daytype" ? lowest - CHECK.floor : (M.target - CHECK.floor)
    step = Math.min(step, Math.floor(Math.max(0, room) / CHECK.step) * CHECK.step)
    if (step <= 0) {
      base.status = "hold"
      base.message = `Your targets are already at the ${CHECK.floor} kcal minimum. Lowering them further is not suggested; talk to a dietitian or doctor if progress stays slow.`
      return base
    }
  }
  base.delta = lowerCalories ? -step : step
  base.status = "suggest"
  const dir = sign < 0 ? (gap > 0 ? "slower" : "faster") : (gap > 0 ? "slower" : "faster")
  base.message = `For ${Math.round(windowDays / 7)} weeks your trend has been consistently ${dir} than your ${Math.abs(targetRate).toFixed(2)} kg/week target. A ${lowerCalories ? "reduction" : "increase"} of ${step} kcal a day is suggested.`
  return base
}

/** The targets after an adjustment: the change goes to carbohydrates; protein, fat and fibre stay. */
export function adjustedTargets(p: Profile, delta: number) {
  const out = {} as Record<DayType, ReturnType<typeof targetsOf>>
  for (const t of ["rest", "gym", "run"] as DayType[]) {
    const cur = targetsOf(p, t)
    out[t] = { ...cur, k: cur.k + delta, c: Math.max(0, Math.round(cur.c + delta / 4)) }
  }
  return out
}
