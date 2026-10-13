export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
export function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(s: string, n: number) {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}
export function daysBetween(a: string, b: string) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 864e5)
}
export const today = () => iso(new Date())
export function weekStart(s: string) {
  const d = parseISO(s)
  return addDays(s, -((d.getDay() + 6) % 7))
}
export function fmtDate(s: string, style: "short" | "day" | "long" | "year" = "short") {
  const d = parseISO(s)
  if (style === "long") return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  if (style === "day") return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
  if (style === "year") return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}
export function ageFrom(dob: string | null | undefined) {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null
  const b = parseISO(dob)
  const n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
  return a >= 10 && a <= 110 ? a : null
}
