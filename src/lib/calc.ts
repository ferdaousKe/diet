import type { Day, FoodEntry, Nutr, Profile } from "./types"
import { addDays, ageFrom, daysBetween, today } from "./dates"
import { clamp, mean, num, slope, sum } from "./utils"

export const blankDay = (date: string): Day => ({ date, food: [], ex: [], water: 0, weight: null, waist: null })
export const isEmptyDay = (d: Day) => !d.food.length && !d.ex.length && !d.water && d.weight == null && d.waist == null

export function entryVals(e: FoodEntry): Nutr {
  if (e.per) {
    const r = (num(e.g) ? e.g : 0) / 100
    return { k: e.per.k * r, p: e.per.p * r, c: e.per.c * r, f: e.per.f * r, fb: (e.per.fb || 0) * r }
  }
  const x = e.fixed || ({} as Partial<Nutr>)
  return { k: x.k || 0, p: x.p || 0, c: x.c || 0, f: x.f || 0, fb: x.fb || 0 }
}
export function totalsOf(entries: FoodEntry[]): Nutr {
  const t = { k: 0, p: 0, c: 0, f: 0, fb: 0 }
  for (const e of entries) {
    const v = entryVals(e)
    t.k += v.k; t.p += v.p; t.c += v.c; t.f += v.f; t.fb += v.fb
  }
  return t
}
export const dayTotals = (d: Day) => totalsOf(d.food)
export const exKcal = (d: Day) => sum(d.ex.map((e) => (num(e.kcal) ? e.kcal : 0)))
export const exMin = (d: Day) => sum(d.ex.map((e) => (num(e.min) ? e.min : 0)))

export interface WeightPoint { date: string; w: number; t: number; waist: number | null }

/** Weigh-ins with an exponentially smoothed trend (10% per day, gap-aware). */
export function weightPoints(days: Record<string, Day>): WeightPoint[] {
  const ds = Object.values(days).filter((d) => num(d.weight)).sort((a, b) => (a.date < b.date ? -1 : 1))
  let t: number | null = null
  let prev: string | null = null
  return ds.map((d) => {
    const w = d.weight as number
    if (t == null || prev == null) t = w
    else {
      const gap = Math.max(1, daysBetween(prev, d.date))
      t = t + (1 - Math.pow(0.9, gap)) * (w - t)
    }
    prev = d.date
    return { date: d.date, w, t, waist: d.waist }
  })
}

export interface Adaptive {
  foodDays: number; weighIns: number; span: number; ok: boolean
  avgIntake?: number; avgEx?: number; slope?: number; tdee?: number; quality?: "Good" | "Fair" | "Low"; reason?: string
}

/** Measured TDEE from the last 4 weeks of intake and weight trend. */
export function adaptive(days: Record<string, Day>): Adaptive {
  const end = today()
  const start = addDays(end, -27)
  const inWin = Object.values(days).filter((d) => d.date >= start && d.date <= end)
  const food = inWin.filter((d) => d.date < end && dayTotals(d).k > 0)
  const ws = inWin
    .filter((d) => num(d.weight))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((d) => [daysBetween(start, d.date), d.weight as number] as [number, number])
  const span = ws.length > 1 ? ws[ws.length - 1][0] - ws[0][0] : 0
  const r: Adaptive = { foodDays: food.length, weighIns: ws.length, span, ok: false }
  if (food.length) {
    r.avgIntake = mean(food.map((d) => dayTotals(d).k))
    r.avgEx = mean(food.map(exKcal))
  }
  if (ws.length >= 2) r.slope = slope(ws)
  if (food.length >= 10 && ws.length >= 3 && span >= 10) {
    r.tdee = (r.avgIntake as number) - (r.slope as number) * 7700
    r.quality = food.length >= 21 && ws.length >= 8 ? "Good" : food.length >= 14 ? "Fair" : "Low"
    r.ok = r.tdee > 900 && r.tdee < 6000
    if (!r.ok) r.reason = "The numbers do not add up yet. Make sure the days you log are complete."
  }
  return r
}

export function metrics(p: Profile, days: Record<string, Day>, o: { profileSaved: boolean; weightOverride?: number | null }) {
  const male = p.sex === "male"
  const h = num(p.height) && p.height > 100 ? p.height : 165
  const hm = h / 100
  const age = ageFrom(p.dob) ?? 30
  const pts = weightPoints(days)
  const tw = pts.length ? pts[pts.length - 1].t : null
  const w = num(o.weightOverride) ? o.weightOverride : o.profileSaved && tw != null ? tw : num(p.weight) ? p.weight : 70
  const bmi = w / (hm * hm)

  let bf: number | null = null
  let bfMethod = ""
  let bfEst = false
  if (num(p.bodyFat) && p.bodyFat > 2 && p.bodyFat < 70) {
    bf = p.bodyFat
    bfMethod = "Your entry"
  } else if (num(p.neck) && num(p.waist) && (male || num(p.hip))) {
    const v = male
      ? 495 / (1.0324 - 0.19077 * Math.log10(p.waist - p.neck) + 0.15456 * Math.log10(h)) - 450
      : 495 / (1.29579 - 0.35004 * Math.log10(p.waist + (p.hip as number) - p.neck) + 0.221 * Math.log10(h)) - 450
    if (Number.isFinite(v) && v > 2 && v < 70) {
      bf = v
      bfMethod = "US Navy tape method"
    }
  }
  if (bf == null) {
    bf = 1.2 * bmi + 0.23 * age - 10.8 * (male ? 1 : 0) - 5.4
    bfMethod = "Estimated from BMI (Deurenberg)"
    bfEst = true
  }
  bf = clamp(bf, 3, 65)
  const lbm = w * (1 - bf / 100)
  const fatMass = w - lbm
  const ffmiN = lbm / (hm * hm) + 6.1 * (1.8 - hm)

  const bmr = {
    mifflin: 10 * w + 6.25 * h - 5 * age + (male ? 5 : -161),
    harris: male ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * age : 447.593 + 9.247 * w + 3.098 * h - 4.33 * age,
    katch: 370 + 21.6 * lbm,
    cunningham: 500 + 22 * lbm,
  }
  const bmrKey = (bmr[p.bmrFormula] != null ? p.bmrFormula : "mifflin") as keyof typeof bmr
  const BMR = bmr[bmrKey]
  const act = num(p.activity) ? p.activity : 1.375
  const tdee = BMR * act
  const sign = p.goal === "lose" ? -1 : p.goal === "gain" ? 1 : 0
  const rate = num(p.rate) ? p.rate : 0.5
  const delta = sign * rate * 1100 // 7,700 kcal per kg ÷ 7 days
  const credit = num(p.exCredit) ? p.exCredit : 0.5
  const ad = adaptive(days)
  const floor = male ? 1500 : 1200

  let mode: Profile["targetMode"] = p.targetMode || "formula"
  let base: number
  let modeNote = ""
  if (mode === "custom" && num(p.customKcal) && p.customKcal >= 800) base = p.customKcal
  else if (mode === "adaptive" && ad.ok) base = (ad.tdee as number) - credit * (ad.avgEx || 0) + delta
  else {
    if (mode === "adaptive") modeNote = "Not enough data for the adaptive target yet, so the formula target is used. The Weight tab shows your progress."
    if (mode === "custom") modeNote = "Enter a custom target of at least 800 kcal to use it. The formula target is used until then."
    mode = "formula"
    base = tdee + delta
  }
  let clamped = false
  if (mode !== "custom" && base < floor) {
    base = floor
    clamped = true
  }
  const target = Math.round(base / 10) * 10
  const refAdjusted = bmi > 30
  const refW = refAdjusted ? 25 * hm * hm : w
  const proteinPerKg = num(p.proteinPerKg) ? p.proteinPerKg : 1.8
  const proteinG = Math.round(proteinPerKg * refW)
  const fatPct = num(p.fatPct) ? p.fatPct : 30
  const waterAuto = Math.round((w * 35) / 50) * 50
  const water = num(p.waterGoal) && p.waterGoal >= 250 ? p.waterGoal : waterAuto
  const exGoal = num(p.exGoal) && p.exGoal > 0 ? p.exGoal : 150
  const inch = h / 2.54 - 60
  const ideal: Record<string, number> = {
    Devine: male ? 50 + 2.3 * inch : 45.5 + 2.3 * inch,
    Robinson: male ? 52 + 1.9 * inch : 49 + 1.7 * inch,
    Miller: male ? 56.2 + 1.41 * inch : 53.1 + 1.36 * inch,
    Hamwi: male ? 48 + 2.7 * inch : 45.5 + 2.2 * inch,
  }
  const healthy: [number, number] = [18.5 * hm * hm, 24.9 * hm * hm]
  const goalW = num(p.goalWeight) ? p.goalWeight : null
  const goalBmi = goalW ? goalW / (hm * hm) : null
  let eta: { weeks: number; kg: number; date: string } | null = null
  if (goalW && sign !== 0 && rate > 0) {
    const diff = (w - goalW) * -sign
    if (diff > 0.05) {
      const weeks = diff / rate
      eta = { weeks, kg: diff, date: addDays(today(), Math.round(weeks * 7)) }
    }
  }
  const whtr = num(p.waist) ? p.waist / h : null
  const whr = num(p.waist) && num(p.hip) && p.hip > 0 ? p.waist / p.hip : null
  const maxHR = Math.round(208 - 0.7 * age)
  const rateHigh = sign !== 0 && rate > w * 0.01
  return {
    male, h, hm, age, w, tw, bmi, bf, bfMethod, bfEst, lbm, fatMass, ffmiN, bmr, bmrKey, BMR, act, tdee, sign, rate, delta,
    credit, ad, floor, mode, modeNote, clamped, target, refAdjusted, refW, proteinPerKg, proteinG, fatPct, water, waterAuto, exGoal, ideal, healthy,
    goalW, goalBmi, eta, whtr, whr, maxHR, rateHigh,
  }
}
export type Metrics = ReturnType<typeof metrics>

export function macroTargets(budget: number, M: Metrics) {
  const p = M.proteinG
  const f = (budget * M.fatPct) / 100 / 9
  return { p, f, c: Math.max(0, (budget - p * 4 - f * 9) / 4), fb: (14 * budget) / 1000 }
}

export type Tone = "good" | "warn" | "bad" | "secondary"
export function bmiCat(b: number): [string, Tone] {
  if (b < 18.5) return ["Underweight", "warn"]
  if (b < 25) return ["Healthy", "good"]
  if (b < 30) return ["Overweight", "warn"]
  if (b < 35) return ["Obesity, class I", "bad"]
  if (b < 40) return ["Obesity, class II", "bad"]
  return ["Obesity, class III", "bad"]
}
export function bfCat(bf: number, male: boolean): [string, Tone] {
  const t: [number, string, Tone][] = male
    ? [[6, "Essential", "warn"], [14, "Athletic", "good"], [18, "Fit", "good"], [25, "Average", "secondary"], [999, "High", "bad"]]
    : [[14, "Essential", "warn"], [21, "Athletic", "good"], [25, "Fit", "good"], [32, "Average", "secondary"], [999, "High", "bad"]]
  const r = t.find((x) => bf < x[0]) || t[t.length - 1]
  return [r[1], r[2]]
}
