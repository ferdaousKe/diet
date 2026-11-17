/* Nutrition label scanning: OCR a photo in the browser (Tesseract.js, French + English),
   then read calories and macros per 100 g from the text. Nothing leaves the device except
   the OCR engine and language files, which are downloaded on first use. */
import type { Food } from "@/lib/types"
import { norm, round1 } from "@/lib/utils"

export type LabelValues = Partial<Pick<Food, "k" | "p" | "c" | "f" | "fb" | "sg">>

/** Downscale, grayscale and stretch contrast: small, crisp images read faster and better. */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
  const cv = document.createElement("canvas")
  cv.width = Math.round(bmp.width * scale)
  cv.height = Math.round(bmp.height * scale)
  const ctx = cv.getContext("2d")!
  ctx.drawImage(bmp, 0, 0, cv.width, cv.height)
  bmp.close()
  const img = ctx.getImageData(0, 0, cv.width, cv.height)
  const px = img.data
  let lo = 255
  let hi = 0
  for (let i = 0; i < px.length; i += 4) {
    const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    px[i] = y
    if (y < lo) lo = y
    if (y > hi) hi = y
  }
  const span = Math.max(1, hi - lo)
  for (let i = 0; i < px.length; i += 4) {
    const y = ((px[i] - lo) * 255) / span
    px[i] = px[i + 1] = px[i + 2] = y
  }
  ctx.putImageData(img, 0, 0)
  return cv
}

export async function scanLabel(file: File, onProgress?: (p: number) => void): Promise<{ values: LabelValues; text: string }> {
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker(["fra", "eng"], 1, {
    logger: (m) => { if (m.status === "recognizing text") onProgress?.(m.progress) },
  })
  try {
    const { data } = await worker.recognize(await prepare(file))
    return { values: parseLabel(data.text), text: data.text }
  } finally {
    await worker.terminate()
  }
}

/* ---------------- Text parsing ---------------- */

// Common OCR slips inside numbers: o→0 next to digits, l→1 between digits, "1 ,5" → "1,5".
const fixDigits = (s: string) =>
  s.replace(/(?<=[\s\d.,(])o(?=[\d.,]|\s*g\b)/g, "0").replace(/(?<=\d)[li](?=\d)/g, "1").replace(/(\d)\s+([.,])\s*(\d)/g, "$1$2$3")
const NUM = /\d+(?:[.,]\d+)?/g
const toNum = (s: string) => Number(s.replace(",", "."))
const numbers = (s: string) => (fixDigits(s).match(NUM) ?? []).map(toNum)

/** Reads the first number after the keyword, ignoring anything from a sub-line ("dont", "of which"…) on.
    On two-column labels the first number is the per-100 g column. */
function findMacro(lines: string[], keys: RegExp, skip: RegExp | null, max: number): number | undefined {
  for (const line of lines) {
    const cut = skip ? line.search(skip) : -1
    const seg = cut >= 0 ? line.slice(0, cut) : line
    const m = keys.exec(seg)
    if (!m) continue
    const v = numbers(seg.slice(m.index + m[0].length))[0]
    if (v != null && v <= max) return round1(v)
  }
  return undefined
}

function findEnergy(lines: string[], flat: string): number | undefined {
  const ok = (k: number) => (k >= 0 && k <= 950 ? Math.round(k) : undefined)
  const kcal = /(\d+(?:[.,]\d+)?)\s*k\s*ca[l1i]/.exec(flat) // "362 kcal"
  if (kcal) return ok(toNum(kcal[1]))
  const after = /k\s*ca[l1i]\)?\s*:?\s*(\d+(?:[.,]\d+)?)(?!\s*k\s*j)/.exec(flat) // "kcal 362"
  const kj = /(\d+(?:[.,]\d+)?)\s*k\s*j\b/.exec(flat)
  // "Énergie (kJ/kcal) 1520/362": the kJ value is about 4.18× the kcal one.
  for (const line of lines) {
    if (!/energie|energy|valeur energetique/.test(line)) continue
    const ns = numbers(line.replace(/\(?k\s*j\s*\/?\s*k\s*cal\)?/, " "))
    for (let i = 0; i + 1 < ns.length; i++) {
      const r = ns[i] / ns[i + 1]
      if (r > 4 && r < 4.4) return ok(ns[i + 1])
    }
  }
  if (after && !/k\s*j\s*\/?\s*k\s*cal/.test(flat)) return ok(toNum(after[1]))
  if (kj) return ok(toNum(kj[1]) / 4.184)
  return undefined
}

export function parseLabel(raw: string): LabelValues {
  const text = norm(raw).replace(/[|]/g, " ")
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const flat = fixDigits(lines.join(" "))
  const out: LabelValues = {
    k: findEnergy(lines, flat),
    f: findMacro(lines, /matieres? grasses?|lipides|graisses|\bfat\b/, /satur|dont|of which|trans|mono|poly/, 100),
    c: findMacro(lines, /glucides|carbohydrates?|hydrates de carbone/, /dont|sucres|sugars?|of which|polyol|amidon|starch/, 100),
    p: findMacro(lines, /proteines?|proteins?/, null, 100),
    fb: findMacro(lines, /fibres?|fiber/, null, 100),
  }
  // Serving size: "par portion de 30 g", "portion (30 g)", "per serving 30g".
  const sg = /(?:portion|serving)\D{0,15}(\d+(?:[.,]\d+)?)\s*(?:g|ml)\b/.exec(flat)
  if (sg && toNum(sg[1]) > 0 && toNum(sg[1]) <= 2000) out.sg = round1(toNum(sg[1]))
  for (const k of Object.keys(out) as (keyof LabelValues)[]) if (out[k] == null) delete out[k]
  return out
}
