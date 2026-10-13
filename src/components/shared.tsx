import { useEffect, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, PenLine, Quote, RefreshCw, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { QuotesEditor } from "@/components/editors"
import { addDays, fmtDate, parseISO, today } from "@/lib/dates"
import { quoteIndex, quoteList } from "@/lib/data"
import type { LedgerState } from "@/lib/store"
import type { Metrics } from "@/lib/calc"
import type { Meal } from "@/lib/types"
import { cn, fmt } from "@/lib/utils"

export interface ViewProps {
  s: LedgerState
  M: Metrics
  date: string
  setDate: (d: string) => void
  go: (tab: string) => void
  meal: Meal
  setMeal: (m: Meal) => void
}

export { NumberField, SelectField, UnitInput } from "@/components/fields"

export function DateNav({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const t = today()
  const label = date === t ? "Today" : date === addDays(t, -1) ? "Yesterday" : parseISO(date).toLocaleDateString("en-GB", { weekday: "long" })
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><ChevronLeft /></Button>
      <Button variant="outline" size="icon" aria-label="Next day" disabled={date >= t} onClick={() => setDate(addDays(date, 1) > t ? t : addDays(date, 1))}><ChevronRight /></Button>
      <div className="mr-1 grid min-w-0">
        <span className="font-display text-2xl leading-tight font-semibold">{label}</span>
        <span className="text-[13px] text-muted-foreground">{fmtDate(date, "long")}</span>
      </div>
      {date !== t && <Button variant="secondary" size="sm" onClick={() => setDate(t)}>Back to today</Button>}
    </div>
  )
}

export function QuoteCard({ seed, name, mine }: { seed: string; name?: string; mine?: string[] }) {
  const [offset, setOffset] = useState(0)
  const [editing, setEditing] = useState(false)
  const list = quoteList(mine)
  const q = list[(quoteIndex(seed) + offset) % list.length]
  const h = new Date().getHours()
  const hello = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
  return (
    <section className="quote-card relative isolate overflow-hidden rounded-[28px] px-6 py-6 sm:px-9 sm:py-8">
      <div className="relative z-10 grid gap-3">
        <p className="flex items-center gap-2 text-[12px] font-extrabold tracking-[0.14em] text-plum uppercase">
          <Sparkles className="size-4" /> {hello}{name ? `, ${name}` : ""}
        </p>
        <blockquote className="flex gap-3">
          <Quote className="mt-1 size-6 shrink-0 text-primary" aria-hidden="true" />
          <p className="max-w-[46ch] font-display text-[clamp(22px,3.3vw,32px)] leading-snug font-medium italic">{q}</p>
        </blockquote>
        <div className="-ml-2 flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" className="text-plum" onClick={() => setOffset((o) => o + 1)}>
            <RefreshCw /> Another one
          </Button>
          <Button variant="ghost" size="sm" className="text-plum" onClick={() => setEditing(true)}>
            <PenLine /> My quotes{mine?.length ? ` (${mine.length})` : ""}
          </Button>
        </div>
      </div>
      <QuotesEditor open={editing} onClose={() => setEditing(false)} />
    </section>
  )
}

export function QuoteLine({ seed, mine }: { seed: string; mine?: string[] }) {
  const list = quoteList(mine)
  const q = list[quoteIndex(seed) % list.length]
  return <p className="mx-auto max-w-[52ch] text-center font-display text-lg text-plum italic">“{q}”</p>
}

/** One macro: what you need, what you ate, what is left. `pace` (0–1) marks where you'd typically be by now. */
export function MacroBar({ color, label, eaten, target, pace, moreIsFine }: {
  color: string; label: string; eaten: number; target: number; pace?: number | null; moreIsFine?: boolean
}) {
  const left = target - eaten
  const status = left > 0.5 ? `${fmt(left)} g left` : left < -0.5 ? `${fmt(-left)} g over` : "Target reached"
  const tone = left > 0.5 ? "text-foreground" : left < -0.5 && !moreIsFine ? "text-warn" : "text-good"
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
        <span className="flex items-center gap-2 font-bold"><i className="size-2.5 rounded-full" style={{ background: `var(--${color})` }} />{label}</span>
        <span className={cn("font-display text-[17px] font-semibold tnum", tone)}>{status}</span>
      </div>
      <div className="relative">
        <Progress value={target > 0 ? (eaten / target) * 100 : 0} indicatorStyle={{ background: `var(--${color})` }} />
        {pace != null && (
          <i className="absolute -top-1 h-4 w-[3px] -translate-x-1/2 rounded-full border border-card bg-foreground/70" style={{ left: `${pace * 100}%` }} aria-hidden="true" />
        )}
      </div>
      <span className="text-xs text-muted-foreground tnum">Eaten {fmt(eaten)} g of {fmt(target)} g you need</span>
    </div>
  )
}

export function CalorieRing({ eaten, budget }: { eaten: number; budget: number }) {
  const r = 70
  const c = 2 * Math.PI * r
  const pct = budget > 0 ? Math.min(1, eaten / budget) : 0
  const over = eaten > budget
  const left = Math.round(budget - eaten)
  return (
    <div className="relative size-[180px] shrink-0">
      <svg viewBox="0 0 180 180" className="size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--primary)" }} />
            <stop offset="1" style={{ stopColor: "var(--fat)" }} />
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r={r} fill="none" style={{ stroke: "var(--secondary)" }} strokeWidth="16" />
        <circle
          cx="90" cy="90" r={r} fill="none" strokeWidth="16" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ stroke: over ? "var(--bad)" : "url(#ring-grad)", transition: "stroke-dashoffset .7s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className={cn("font-display text-[42px] leading-none font-semibold tnum", over && "text-bad")}>{fmt(Math.abs(left))}</span>
        <span className="mt-1 text-xs font-bold text-muted-foreground">{over ? "kcal over" : "kcal left"}</span>
      </div>
    </div>
  )
}

export function StatTile({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("grid min-w-0 gap-0.5 rounded-2xl bg-secondary/70 px-3.5 py-3", className)}>
      <span className="text-[10.5px] font-extrabold tracking-[0.08em] text-muted-foreground uppercase">{label}</span>
      <b className="font-display text-2xl leading-tight font-semibold tnum">{value}</b>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

export function ConfirmDelete({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return armed ? (
    <Button variant="outline" size="sm" className="border-bad text-bad hover:text-bad" onClick={onConfirm}>Confirm</Button>
  ) : (
    <Button variant="ghost" size="icon-sm" aria-label={label} onClick={() => setArmed(true)}><Trash2 /></Button>
  )
}

export function Banners({ s, onMetab, go }: { s: LedgerState; onMetab?: boolean; go: (t: string) => void }) {
  return (
    <>
      {s.conn === "device" && (
        <div className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          Not signed in to claude.ai: your data is saved in this browser only.
        </div>
      )}
      {s.conn === "error" && (
        <div className="rounded-2xl bg-secondary px-4 py-3 text-sm">The connection to your saved data was lost. Reload the page to reconnect.</div>
      )}
      {!onMetab && s.loaded && !s.profileSaved && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          <span>Your targets use example values (165 cm, 70 kg). Add your own details for accurate numbers.</span>
          <Button size="sm" onClick={() => go("metab")}>Set up my profile</Button>
        </div>
      )}
    </>
  )
}

export function Note({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <p className="flex gap-2.5 text-sm leading-relaxed">
      <i className={cn("mt-[7px] size-2 shrink-0 rounded-full", tone === "warn" ? "bg-warn" : "bg-primary")} />
      <span>{children}</span>
    </p>
  )
}
