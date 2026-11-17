export type Meal = "breakfast" | "preworkout" | "lunch" | "postworkout" | "dinner" | "snacks"
export interface Nutr { k: number; p: number; c: number; f: number; fb: number }
export interface FoodEntry { id: string; meal: Meal; name: string; g?: number; per?: Nutr; fixed?: Nutr }
export interface ExEntry { id: string; act: string; name: string; met: number | null; min: number; km: number | null; kcal: number; manual?: boolean }
/** What kind of day it is. Picks that day's calorie and macro targets. */
export type DayType = "rest" | "gym" | "run"
export interface Day {
  date: string; food: FoodEntry[]; ex: ExEntry[]; water: number; weight: number | null; waist: number | null
  /** Chosen day type. Absent: taken from logged workouts, else the profile default. */
  dayType?: DayType
}
export interface Food extends Nutr { id: string; name: string; cat: string; sg: number; sl: string; mine?: boolean }
/** A recorded period. `end` is null while it is ongoing or when the end was not recorded. */
export interface Period { id: string; start: string; end: string | null }
/** A calorie change the person confirmed. */
export interface Adjustment { date: string; delta: number; note: string }
export interface Profile {
  /** Profile format version, used for one-time migrations. */
  v: number
  sex: "female" | "male"
  dob: string
  /** Age in years. When set, used instead of the date of birth. */
  age: number | null
  height: number | null
  weight: number | null
  goalWeight: number | null
  /** Weight the current plan starts from, and the date it applies to. */
  refWeight: number | null
  refDate: string | null
  /** Date to reach the goal weight by. */
  goalDate: string | null
  activity: number
  bodyFat: number | null
  neck: number | null
  waist: number | null
  hip: number | null
  goal: "lose" | "maintain" | "gain"
  rate: number
  bmrFormula: "mifflin" | "harris" | "katch" | "cunningham"
  proteinPerKg: number
  fatPct: number
  exCredit: number
  targetMode: "daytype" | "formula" | "adaptive" | "custom"
  customKcal: number | null
  /** Targets for each day type (used when targetMode is "daytype"). */
  dayTargets: Record<DayType, Nutr>
  /** Day type used when a day has no type chosen and no workout logged. */
  defaultDayType: DayType
  waterGoal: number | null
  exGoal: number
  myQuotes: string[]
  /** Cycle settings. null = not configured (no length is assumed). */
  cycleLength: number | null
  periodLength: number | null
  /** Show estimated cycle phases on the weight chart. */
  showPhases: boolean
  /** Calorie changes confirmed from suggestions, newest last. */
  adjustments: Adjustment[]
  /** Calorie suggestions are hidden until this date. */
  adjSnoozeUntil: string | null
}
