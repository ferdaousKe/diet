import { useState } from "react"
import { Droplet, Dumbbell, Minus, Pencil, Plus, Trash2 } from "lucide-react"
import { WorkoutEditor } from "@/components/editors"
import type { Day, ExEntry } from "@/lib/types"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Banners, CalorieRing, DateNav, MacroBar, QuoteCard, UnitInput, type ViewProps } from "@/components/shared"
import { blankDay, dayTotals, exKcal, macroTargets, totalsOf, weightPoints } from "@/lib/calc"
import { MEALS } from "@/lib/data"
import { fmtDate, today } from "@/lib/dates"
import { setWeight, updateDay } from "@/lib/store"
import { clamp, cn, fmt, parseNum } from "@/lib/utils"

export function TodayView({ s, M, date, setDate, go, setMeal }: ViewProps) {
  const day = s.days[date] ?? blankDay(date)
  const t = dayTotals(day)
  const exk = exKcal(day)
  const credited = Math.round(exk * M.credit)
  const budget = M.target + credited
  const left = Math.round(budget - t.k)
  const mt = macroTargets(budget, M)
  const glassesTarget = clamp(Math.round(M.water / 250), 4, 16)
  const water = day.water || 0
  const pts = weightPoints(s.days)
  const last = pts[pts.length - 1]
  const [qw, setQw] = useState("")
  const [editEx, setEditEx] = useState<ExEntry | null>(null)
  // Pace: share of the day's eating window (7:00–21:00) already behind you
  const now = new Date()
  const hours = now.getHours() + now.getMinutes() / 60
  const pace = date === today() ? clamp((hours - 7) / 14, 0, 1) : null
  const nowLabel = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  const firstName = (s.me?.name || "").split(" ")[0]

  const saveWeight = () => {
    const v = parseNum(qw)
    if (v == null || v < 25 || v > 400) { toast("Enter a weight in kg, for example 68.4"); return }
    setWeight(date, v)
    setQw("")
    toast.success("Weigh-in saved. One more data point for your trend.")
  }
  const setWater = (v: number) => updateDay(date, (d) => { d.water = clamp(v, 0, 40) })

  return (
    <div className="grid gap-5">
      <Banners s={s} go={go} />
      {date === today() && <QuoteCard seed={date} name={firstName} mine={s.profile.myQuotes} />}
      <WorkoutEditor target={editEx ? { date, entry: editEx } : null} weight={M.w} onClose={() => setEditEx(null)} />
      <DateNav date={date} setDate={setDate} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="grid gap-6">
            <div className="flex flex-wrap items-center gap-6">
              <CalorieRing eaten={t.k} budget={budget} />
              <div className="grid min-w-0 flex-1 basis-[240px] gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 tnum">
                  <EqItem v={M.target} l="Target" />
                  <Op>−</Op>
                  <EqItem v={t.k} l="Food" />
                  <Op>+</Op>
                  <EqItem v={credited} l={exk && M.credit < 1 ? `Exercise ${Math.round(M.credit * 100)}%` : "Exercise"} />
                  <Op>=</Op>
                  <EqItem v={left} l="Left" strong />
                </div>
                <p className="text-sm text-muted-foreground">
                  {left < 0
                    ? "A little over today. That's fine: one day never undoes a week of good choices."
                    : t.k === 0
                      ? "Nothing logged yet. Start with breakfast and watch the ring fill up."
                      : pace != null
                        ? `You've used ${fmt((t.k / budget) * 100)}% of today's budget. By ${nowLabel} you'd typically be around ${fmt(pace * budget)} kcal.`
                        : `You used ${fmt((t.k / budget) * 100)}% of this day's budget.`}
                </p>
              </div>
            </div>
            <div className="grid gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <b className="font-display text-lg font-semibold">Your macros for {date === today() ? "today" : "this day"}</b>
                {pace != null && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><i className="h-3 w-[3px] rounded-full bg-foreground/70" />where you'd be by {nowLabel}</span>}
              </div>
              <p className="text-xs text-muted-foreground tnum">Needs: {fmt(mt.p)} g protein · {fmt(mt.c)} g carbs · {fmt(mt.f)} g fat · {fmt(mt.fb)} g fiber</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <MacroBar color="protein" label="Protein" eaten={t.p} target={mt.p} pace={pace} moreIsFine />
              <MacroBar color="carbs" label="Carbs" eaten={t.c} target={mt.c} pace={pace} />
              <MacroBar color="fat" label="Fat" eaten={t.f} target={mt.f} pace={pace} />
              <MacroBar color="fiber" label="Fiber" eaten={t.fb} target={mt.fb} pace={pace} moreIsFine />
            </div>
            <RemainingPlan day={day} left={{ k: budget - t.k, p: mt.p - t.p, c: mt.c - t.c, f: mt.f - t.f }} isToday={date === today()} />
          </CardContent>
        </Card>
        <NutritionLabel date={date} items={day.food.length} t={t} mt={mt} budget={budget} exk={exk} water={water} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Meals</CardTitle>
            <CardAction><Button variant="secondary" size="sm" onClick={() => go("food")}>Food diary</Button></CardAction>
          </CardHeader>
          <CardContent className="grid">
            {MEALS.map(([k, l], i) => {
              const es = day.food.filter((e) => e.meal === k)
              const kc = totalsOf(es).k
              return (
                <div key={k} className={cn("grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5", i && "border-t")}>
                  <div className="grid min-w-0">
                    <b className="text-[15px]">{l}</b>
                    <span className="truncate text-[13px] text-muted-foreground">
                      {es.length ? es.slice(0, 3).map((e) => e.name).join(", ") + (es.length > 3 ? ` +${es.length - 3} more` : "") : "Nothing logged"}
                    </span>
                  </div>
                  <span className="text-sm tnum">{fmt(kc)} kcal</span>
                  <Button variant="outline" size="icon-sm" aria-label={`Add food to ${l}`} onClick={() => { setMeal(k); go("food") }}><Plus /></Button>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Droplet className="size-5 text-primary" /> Water</CardTitle>
            <CardAction><span className="text-sm text-muted-foreground tnum">{fmt(water * 250)} / {fmt(M.water)} ml</span></CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: Math.max(glassesTarget, water) }, (_, i) => (
                <button
                  key={i}
                  aria-label={`${i + 1} glass${i ? "es" : ""} of water`}
                  onClick={() => setWater(water === i + 1 ? i : i + 1)}
                  className={cn(
                    "h-10 w-8 cursor-pointer rounded-b-[10px] rounded-t-[4px] border-2 border-primary/70 transition-colors",
                    i < water ? "bg-[linear-gradient(to_top,var(--primary)_78%,transparent_78%)]" : "bg-transparent hover:bg-secondary",
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setWater(water - 1)}><Minus /> 250 ml</Button>
              <Button variant="outline" size="sm" onClick={() => setWater(water + 1)}><Plus /> 250 ml</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {water >= glassesTarget ? "Hydration goal reached. Your skin and energy say thank you. " : `Goal: ${fmt(M.water)} ml${s.profile.waterGoal ? " (your own)" : " (35 ml per kg)"}. `}
              <button className="cursor-pointer font-bold text-primary underline-offset-2 hover:underline" onClick={() => go("metab")}>Change goal</button>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Weight & workouts</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="qw">Weigh-in for this day</Label>
              <div className="flex gap-2">
                <UnitInput id="qw" unit="kg" step="0.1" className="flex-1" value={qw} placeholder={day.weight != null ? fmt(day.weight, 1) : last ? fmt(last.w, 1) : "68.4"} onChange={(e) => setQw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveWeight()} />
                <Button onClick={saveWeight}>Save</Button>
              </div>
              <span className="text-xs text-muted-foreground">
                {day.weight != null ? `Logged ${fmt(day.weight, 1)} kg for this day. ` : ""}
                {last ? `Trend ${fmt(last.t, 1)} kg · last weigh-in ${fmtDate(last.date, "day")}` : "No weigh-ins yet."}
              </span>
            </div>
            <Separator />
            <div className="grid">
              {day.ex.length ? day.ex.map((e) => (
                <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 py-1.5">
                  <div className="grid min-w-0"><span className="truncate">{e.name}</span><small className="text-xs text-muted-foreground">{fmt(e.min)} min{e.km != null ? ` · ${fmt(e.km, 1)} km` : ""}</small></div>
                  <span className="text-sm tnum">{fmt(e.kcal)} kcal</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${e.name}`} onClick={() => setEditEx(e)}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${e.name}`} onClick={() => updateDay(date, (d) => { d.ex = d.ex.filter((x) => x.id !== e.id) })}><Trash2 /></Button>
                </div>
              )) : <p className="text-sm text-muted-foreground">No workouts logged.</p>}
            </div>
            <Button variant="secondary" onClick={() => go("exercise")}><Dumbbell /> Log a workout</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Splits what is left across the meals still ahead (empty meals whose time hasn't passed). */
const MEAL_SHARE: Record<string, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snacks: 0.1 }
const MEAL_ENDS: Record<string, number> = { breakfast: 11, lunch: 15.5, snacks: 21, dinner: 24 }
function RemainingPlan({ day, left, isToday }: { day: Day; left: { k: number; p: number; c: number; f: number }; isToday: boolean }) {
  const now = new Date()
  const h = now.getHours() + now.getMinutes() / 60
  const ahead = MEALS.filter(([k]) => !day.food.some((e) => e.meal === k) && (!isToday || h < MEAL_ENDS[k]))
  const L = { k: Math.max(0, left.k), p: Math.max(0, left.p), c: Math.max(0, left.c), f: Math.max(0, left.f) }
  if (L.k < 20) {
    return <p className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm">Your needs for {isToday ? "today" : "this day"} are covered. Well done!</p>
  }
  const total = ahead.reduce((a, [k]) => a + MEAL_SHARE[k], 0)
  return (
    <div className="grid gap-2 rounded-2xl bg-secondary/70 px-4 py-3.5">
      <p className="text-sm">
        <b>Still to eat {isToday ? "today" : "this day"}:</b>{" "}
        <span className="tnum">{fmt(L.k)} kcal · {fmt(L.p)} g protein · {fmt(L.c)} g carbs · {fmt(L.f)} g fat</span>
      </p>
      {ahead.length > 0 && (
        <div className="grid gap-1">
          {ahead.map(([k, l]) => {
            const r = MEAL_SHARE[k] / total
            return (
              <div key={k} className="flex flex-wrap justify-between gap-x-3 text-[13px]">
                <span className="font-bold">{l}</span>
                <span className="text-muted-foreground tnum">≈ {fmt(L.k * r)} kcal · P {fmt(L.p * r)} · C {fmt(L.c * r)} · F {fmt(L.f * r)} g</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EqItem({ v, l, strong }: { v: number; l: string; strong?: boolean }) {
  return (
    <div className="grid">
      <b className={cn("font-display text-[22px] leading-tight font-semibold", strong && "text-primary", v < 0 && "text-bad")}>{fmt(v)}</b>
      <span className="text-[10.5px] font-extrabold tracking-[0.07em] text-muted-foreground uppercase">{l}</span>
    </div>
  )
}
const Op = ({ children }: { children: string }) => <span className="text-lg text-muted-foreground">{children}</span>

function NutritionLabel({ date, items, t, mt, budget, exk, water }: {
  date: string; items: number; t: { k: number; p: number; c: number; f: number; fb: number }
  mt: { p: number; c: number; f: number; fb: number }; budget: number; exk: number; water: number
}) {
  const pc = (a: number, b: number) => (b > 0 ? fmt((a / b) * 100) + "%" : "—")
  return (
    <section className="nf shadow-soft" aria-label="Nutrition facts for this day">
      <h3 className="font-display text-[32px] leading-none font-extrabold tracking-tight">Nutrition Facts</h3>
      <div className="pt-1 pb-1 text-[13px]">{date === today() ? "Today" : fmtDate(date, "day")} · {items} item{items === 1 ? "" : "s"} logged</div>
      <div className="r10" />
      <div className="pt-1 text-xs font-extrabold">Amount eaten</div>
      <div className="flex items-end justify-between pb-1 font-display font-extrabold">
        <span className="text-2xl">Calories</span>
        <b className="text-[42px] leading-none tnum">{fmt(t.k)}</b>
      </div>
      <div className="r5" />
      <div className="row nob justify-end text-xs font-extrabold">% Target*</div>
      <div className="row"><span><b>Total Fat</b> {fmt(t.f)}g</span><b>{pc(t.f, mt.f)}</b></div>
      <div className="row"><span><b>Total Carbohydrate</b> {fmt(t.c)}g</span><b>{pc(t.c, mt.c)}</b></div>
      <div className="row ind"><span>Dietary Fiber {fmt(t.fb)}g</span><b>{pc(t.fb, mt.fb)}</b></div>
      <div className="row"><span><b>Protein</b> {fmt(t.p)}g</span><b>{pc(t.p, mt.p)}</b></div>
      <div className="r10" />
      <div className="row nob"><span>Exercise</span><span>{fmt(exk)} kcal</span></div>
      <div className="row"><span>Water</span><span>{fmt(water * 250)} ml</span></div>
      <div className="r5" />
      <p className="mt-1.5 text-[11.5px] leading-snug">* Percent of this day's targets, based on a {fmt(budget)} kcal budget.</p>
    </section>
  )
}
