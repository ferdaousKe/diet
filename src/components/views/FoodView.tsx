import { useMemo, useState, type ReactNode } from "react"
import { ChevronDown, Copy, Pencil, PlusCircle, Search, Trash2, X } from "lucide-react"
import { FoodEditor, FoodEntryEditor, type FoodEditTarget } from "@/components/editors"
import type { FoodEntry } from "@/lib/types"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Banners, ConfirmDelete, DateNav, QuoteLine, UnitInput, type ViewProps } from "@/components/shared"
import { BarsChart, dayNum } from "@/components/charts"
import { blankDay, dayTotals, entryVals, exKcal, totalsOf } from "@/lib/calc"
import { CATS, FOODS, MEALS, mealName } from "@/lib/data"
import { addDays, fmtDate, today } from "@/lib/dates"
import { deleteFood, updateDay } from "@/lib/store"
import type { Food, Meal } from "@/lib/types"
import { clone, cn, fmt, newId, norm, parseNum, round1 } from "@/lib/utils"

export function FoodView({ s, M, date, setDate, go, meal, setMeal }: ViewProps) {
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")
  const [pickId, setPickId] = useState<string | null>(null)
  const [amt, setAmt] = useState("")
  const [editEntry, setEditEntry] = useState<FoodEntry | null>(null)
  const [foodEdit, setFoodEdit] = useState<FoodEditTarget | null>(null)
  const day = s.days[date] ?? blankDay(date)

  const all = useMemo<Food[]>(() => [...Object.values(s.foods).map((f) => ({ ...f, mine: true })), ...FOODS], [s.foods])
  const results = useMemo(() => {
    const nq = norm(q.trim())
    let list = all
    if (cat === "mine") list = list.filter((f) => f.mine)
    else if (cat !== "all") list = list.filter((f) => f.cat === cat)
    if (nq) {
      const words = nq.split(/\s+/)
      list = list.filter((f) => words.every((w) => norm(f.name).includes(w)))
      list = [...list].sort((a, b) => (norm(a.name).startsWith(nq) ? 0 : 1) - (norm(b.name).startsWith(nq) ? 0 : 1))
    }
    return list
  }, [all, q, cat])
  const pick = pickId ? all.find((f) => f.id === pickId) : undefined
  const grams = parseNum(amt) ?? pick?.sg ?? 0

  const choose = (f: Food) => { setPickId(f.id); setAmt(String(f.sg)) }
  const addPicked = () => {
    if (!pick) return
    if (!(grams > 0)) { toast("Enter an amount in grams."); return }
    updateDay(date, (d) => { d.food.push({ id: newId(), meal, name: pick.name, g: round1(grams), per: { k: pick.k, p: pick.p, c: pick.c, f: pick.f, fb: pick.fb } }) })
    toast.success(`${pick.name} added to ${mealName(meal)}`)
    setPickId(null)
  }

  const prev = s.days[addDays(date, -1)]
  const dates14 = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13))

  return (
    <div className="grid gap-5">
      <Banners s={s} go={go} />
      <DateNav date={date} setDate={setDate} />
      <FoodEntryEditor target={editEntry ? { date, entry: editEntry } : null} onClose={() => setEditEntry(null)} />
      <FoodEditor target={foodEdit} onClose={() => setFoodEdit(null)} onSaved={(f) => { setCat("mine"); setQ(""); choose(f) }} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader><CardTitle>Add food</CardTitle><CardDescription>Search {FOODS.length}+ foods or your own</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search foods" placeholder="e.g. yogurt, couscous, salmon" className="pl-9" value={q} onChange={(e) => { setQ(e.target.value); setPickId(null) }} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATS.map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => { setCat(k); setPickId(null) }}
                  aria-pressed={cat === k}
                  className={cn("cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors", cat === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/60")}
                >{l}</button>
              ))}
            </div>

            {pick && (
              <div className="grid gap-3 rounded-2xl border-2 border-primary/60 bg-secondary/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid">
                    <b className="text-base">{pick.name}</b>
                    <span className="text-xs text-muted-foreground">Per 100 g: {fmt(pick.k)} kcal · P {fmt(pick.p, 1)} · C {fmt(pick.c, 1)} · F {fmt(pick.f, 1)} g</span>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setPickId(null)}><X /></Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label htmlFor="famt">Amount</Label><UnitInput id="famt" unit="g" step="1" value={amt} onChange={(e) => setAmt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPicked()} autoFocus /></div>
                  <div className="grid gap-1.5"><Label htmlFor="fmeal">Meal</Label><MealSelect id="fmeal" meal={meal} setMeal={setMeal} /></div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {([[pick.sg, `${pick.sl} · ${fmt(pick.sg)} g`], [Math.round(pick.sg / 2), "½ serving"], [pick.sg * 2, "2 servings"], [100, "100 g"]] as [number, string][]).map(([g, l]) => (
                    <Button key={l} variant="outline" size="sm" onClick={() => setAmt(String(g))}>{l}</Button>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {([["kcal", pick.k, 0], ["Protein", pick.p, 1], ["Carbs", pick.c, 1], ["Fat", pick.f, 1], ["Fiber", pick.fb, 1]] as [string, number, number][]).map(([l, v, d]) => (
                    <div key={l} className="grid rounded-xl bg-card px-1 py-1.5">
                      <b className="font-display text-lg font-semibold tnum">{fmt((v * grams) / 100, d)}</b>
                      <span className="text-[10px] font-extrabold tracking-wide text-muted-foreground uppercase">{l}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={addPicked}>Add to {mealName(meal)}</Button>
                {pick.mine ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setFoodEdit({ mode: "edit", food: pick })}><Pencil /> Edit this food</Button>
                    <ConfirmDeleteText onConfirm={() => { deleteFood(pick.id); setPickId(null); toast("Food deleted") }} />
                  </div>
                ) : (
                  <div><Button variant="outline" size="sm" onClick={() => setFoodEdit({ mode: "copy", food: pick })}><Pencil /> Copy & edit values</Button></div>
                )}
              </div>
            )}

            {results.length ? (
              <div className="max-h-[380px] overflow-y-auto rounded-2xl border">
                {results.slice(0, 80).map((f, i) => (
                  <button
                    key={f.id}
                    onClick={() => choose(f)}
                    className={cn("flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors hover:bg-secondary", i && "border-t", pickId === f.id && "bg-secondary")}
                  >
                    <span className="grid min-w-0">
                      <span className="truncate font-semibold">{f.name}{f.mine && <Badge variant="accent" className="ml-2 align-middle">Mine</Badge>}</span>
                      <span className="text-xs text-muted-foreground">{f.sl} · {fmt(f.sg)} g</span>
                    </span>
                    <span className="grid text-right">
                      <b className="font-display text-base font-semibold tnum">{fmt(f.k)}</b>
                      <span className="text-[10px] font-bold text-muted-foreground">kcal/100 g</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid min-h-[110px] place-items-center rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                {cat === "mine" && !q ? "You haven't created any foods yet. Use “Create a food” below." : "No match. Try another word, or create the food below."}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Values are typical averages per 100 g. Check packaged labels for exact numbers.</p>

            <Button variant="secondary" onClick={() => setFoodEdit({ mode: "new" })}><PlusCircle /> Create a food</Button>
            <QuickAdd date={date} meal={meal} setMeal={setMeal} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Food diary</CardTitle>
            <CardAction><Badge variant="secondary">{fmtDate(date, "day")}</Badge></CardAction>
          </CardHeader>
          <CardContent className="grid gap-5">
            {MEALS.map(([k, l]) => {
              const es = day.food.filter((e) => e.meal === k)
              return (
                <div key={k} className="grid">
                  <div className="flex items-baseline justify-between border-b-2 border-foreground/80 pb-1 font-display text-lg font-semibold">
                    <span>{l}</span><span className="text-base tnum">{fmt(totalsOf(es).k)} kcal</span>
                  </div>
                  {es.length ? es.map((e) => {
                    const v = entryVals(e)
                    return (
                      <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_86px_48px_32px] items-center gap-2 border-b py-2">
                        <button className="group grid min-w-0 cursor-pointer rounded-lg text-left" aria-label={`Edit ${e.name}`} onClick={() => setEditEntry(e)}>
                          <span className="flex min-w-0 items-center gap-1.5"><span className="truncate group-hover:text-primary">{e.name}</span><Pencil className="size-3 shrink-0 text-muted-foreground group-hover:text-primary" /></span>
                          <small className="text-xs text-muted-foreground">P {fmt(v.p)} · C {fmt(v.c)} · F {fmt(v.f)} g</small>
                        </button>
                        {e.per ? (
                          <UnitInput
                            key={`${e.id}-${e.g}`}
                            aria-label={`Grams of ${e.name}`}
                            unit="g"
                            step="1"
                            className="[&_input]:h-8 [&_input]:text-sm"
                            defaultValue={e.g}
                            onBlur={(ev) => {
                              const g = parseNum(ev.target.value)
                              if (g != null && g >= 0 && g !== e.g) updateDay(date, (d) => { const x = d.food.find((y) => y.id === e.id); if (x) x.g = round1(g) })
                            }}
                            onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
                          />
                        ) : <span className="text-xs text-muted-foreground">quick add</span>}
                        <b className="text-right tnum">{fmt(v.k)}</b>
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${e.name}`} onClick={() => updateDay(date, (d) => { d.food = d.food.filter((x) => x.id !== e.id) })}><Trash2 /></Button>
                      </div>
                    )
                  }) : <p className="py-2 text-sm text-muted-foreground">Nothing yet.</p>}
                </div>
              )
            })}
            <div className="flex flex-wrap justify-between gap-2 border-t-2 border-foreground/80 pt-2 font-bold tnum">
              <span>Day total</span>
              <span>{fmt(dayTotals(day).k)} kcal · P {fmt(dayTotals(day).p)} · C {fmt(dayTotals(day).c)} · F {fmt(dayTotals(day).f)} g</span>
            </div>
            {!day.food.length && prev?.food.length ? (
              <Button variant="secondary" onClick={() => { updateDay(date, (d) => { d.food = prev.food.map((e) => ({ ...clone(e), id: newId() })) }); toast.success(`Copied ${prev.food.length} items`) }}>
                <Copy /> Copy the previous day's {prev.food.length} items
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last 14 days</CardTitle>
          <CardDescription className="flex flex-wrap gap-4">
            <Legend color="var(--primary)" label="Within budget" /><Legend color="var(--bad)" label="Over budget" /><Legend color="var(--foreground)" label={`Target ${fmt(M.target)} kcal`} />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BarsChart
            unit="kcal"
            refValue={M.target}
            data={dates14.map((d) => {
              const dd = s.days[d]
              const v = dd ? Math.round(dayTotals(dd).k) : 0
              const b = M.target + M.credit * (dd ? exKcal(dd) : 0)
              return { label: dayNum(d), v, tone: v <= 0 ? "mute" : v > b * 1.05 ? "bad" : "acc" }
            })}
          />
        </CardContent>
      </Card>
      <QuoteLine seed={date + "food"} mine={s.profile.myQuotes} />
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5 text-xs"><i className="h-[3px] w-3.5 rounded-full" style={{ background: color }} />{label}</span>
}

function MealSelect({ id, meal, setMeal }: { id: string; meal: Meal; setMeal: (m: Meal) => void }) {
  return (
    <Select value={meal} onValueChange={(v) => setMeal(v as Meal)}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>{MEALS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function ConfirmDeleteText({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <ConfirmDelete label="Delete from my foods" onConfirm={onConfirm} /> Delete from my foods
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-3">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-left font-bold">
        {title}<ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-3 pt-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function QuickAdd({ date, meal, setMeal }: { date: string; meal: Meal; setMeal: (m: Meal) => void }) {
  const [v, setV] = useState({ name: "", k: "", p: "", c: "", f: "" })
  const add = () => {
    const k = parseNum(v.k)
    if (k == null || k <= 0) { toast("Enter the calories."); return }
    const n = (x: string) => Math.max(0, parseNum(x) ?? 0)
    updateDay(date, (d) => { d.food.push({ id: newId(), meal, name: v.name.trim() || "Quick add", fixed: { k, p: n(v.p), c: n(v.c), f: n(v.f), fb: 0 } }) })
    setV({ name: "", k: "", p: "", c: "", f: "" })
    toast.success(`${fmt(k)} kcal added to ${mealName(meal)}`)
  }
  return (
    <Section title="Quick add calories">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5"><Label htmlFor="qa-name">Label</Label><Input id="qa-name" placeholder="Restaurant meal" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="qa-meal">Meal</Label><MealSelect id="qa-meal" meal={meal} setMeal={setMeal} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["k", "Calories", "kcal"], ["p", "Protein", "g"], ["c", "Carbs", "g"], ["f", "Fat", "g"]] as [keyof typeof v, string, string][]).map(([key, l, u]) => (
          <div key={key} className="grid gap-1.5"><Label htmlFor={`qa-${key}`}>{l}</Label><UnitInput id={`qa-${key}`} unit={u} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} /></div>
        ))}
      </div>
      <Button onClick={add}>Add to diary</Button>
    </Section>
  )
}
