import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0)
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0)
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o))
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
export const round1 = (n: number) => Math.round(n * 10) / 10

export function slug(s: string) {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function parseNum(s: unknown): number | null {
  if (s == null) return null
  const t = String(s).trim().replace(",", ".")
  if (t === "") return null
  const v = Number(t)
  return Number.isFinite(v) ? v : null
}

export function fmt(n: unknown, d = 0): string {
  if (!num(n)) return "—"
  let v = Math.round(n * 10 ** d) / 10 ** d
  if (v === 0) v = 0
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function signed(n: unknown, d = 1): string {
  if (!num(n)) return "—"
  const v = Math.round(n * 10 ** d) / 10 ** d
  return (v > 0 ? "+" : v < 0 ? "−" : "±") + fmt(Math.abs(v), d)
}

export function slope(pairs: [number, number][]) {
  const n = pairs.length
  if (n < 2) return 0
  const mx = mean(pairs.map((p) => p[0]))
  const my = mean(pairs.map((p) => p[1]))
  let a = 0
  let b = 0
  for (const [x, y] of pairs) {
    a += (x - mx) * (y - my)
    b += (x - mx) ** 2
  }
  return b ? a / b : 0
}

/** JSON with sorted keys, for comparing documents regardless of key order. */
export function stable(o: unknown): string {
  if (Array.isArray(o)) return "[" + o.map(stable).join(",") + "]"
  if (o && typeof o === "object") {
    const r = o as Record<string, unknown>
    return "{" + Object.keys(r).sort().filter((k) => r[k] !== undefined).map((k) => JSON.stringify(k) + ":" + stable(r[k])).join(",") + "}"
  }
  return JSON.stringify(o)
}

export function niceTicks(min: number, max: number, n: number) {
  const span = Math.max(max - min, 1e-6)
  const raw = span / Math.max(1, n - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) || 10 * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const out: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
}
