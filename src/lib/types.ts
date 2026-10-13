export type Meal = "breakfast" | "lunch" | "dinner" | "snacks"
export interface Nutr { k: number; p: number; c: number; f: number; fb: number }
export interface FoodEntry { id: string; meal: Meal; name: string; g?: number; per?: Nutr; fixed?: Nutr }
export interface ExEntry { id: string; act: string; name: string; met: number | null; min: number; km: number | null; kcal: number; manual?: boolean }
export interface Day { date: string; food: FoodEntry[]; ex: ExEntry[]; water: number; weight: number | null; waist: number | null }
export interface Food extends Nutr { id: string; name: string; cat: string; sg: number; sl: string; mine?: boolean }
export interface Profile {
  sex: "female" | "male"
  dob: string
  height: number | null
  weight: number | null
  goalWeight: number | null
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
  targetMode: "formula" | "adaptive" | "custom"
  customKcal: number | null
  waterGoal: number | null
  exGoal: number
  myQuotes: string[]
}
