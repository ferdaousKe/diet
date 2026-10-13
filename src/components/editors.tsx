/* Edit dialogs: every logged item, custom foods and personal quotes can be changed here. */
import { useState, type ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field, UnitInput } from "@/components/fields"
import { weightPoints } from "@/lib/calc"
import { CATS, EXERCISES, EX_INDEX, MEALS } from "@/lib/data"
import { today } from "@/lib/dates"
import { getState, patchProfile, saveFood, setWeight, updateDay, useLedger } from "@/lib/store"
import type { ExEntry, Food, FoodEntry, Meal } from "@/lib/types"
import { fmt, newId, num, parseNum, round1 } from "@/lib/utils"

const str = (v: number | null | undefined) => (v == null ? "" : String(v))
const validDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today()
const pos = (x: string) => Math.max(0, parseNum(x) ?? 0)

function Shell({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>{open ? children : null}</DialogContent>
    </Dialog>
  )
}
function Footer({ onCancel, onSave, label = "Save changes" }: { onCancel: () => void; onSave: () => void; label?: string }) {
  return (
    <DialogFooter>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button onClick={onSave}>{label}</Button>
    </DialogFooter>
  )
}
function NutritionFields({ prefix, v, set, title }: { prefix: string; v: Record<string, string>; set: (k: string, x: string) => void; title: string }) {
  const cols: [string, string, string][] = [["k", "Calories", "kcal"], ["p", "Protein", "g"], ["c", "Carbs", "g"], ["f", "Fat", "g"], ["fb", "Fiber", "g"]]
  return (
    <div className="grid gap-2">
      <span className="text-sm font-bold">{title}</span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cols.map(([k, l, u]) => (
          <Field key={k} id={`${prefix}-${k}`} label={l}>
            <UnitInput id={`${prefix}-${k}`} unit={u} step="any" value={v[k]} onChange={(e) => set(k, e.target.value)} />
          </Field>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Food diary entry ---------------- */
export function FoodEntryEditor({ target, onClose }: { target: { date: string; entry: FoodEntry } | null; onClose: () => void }) {
  return <Shell open={!!target} onClose={onClose}>{target && <FoodEntryForm key={target.entry.id} {...target} onDone={onClose} />}</Shell>
}
function FoodEntryForm({ date, entry, onDone }: { date: string; entry: FoodEntry; onDone: () => void }) {
  const per = !!entry.per
  const n = entry.per ?? entry.fixed ?? { k: 0, p: 0, c: 0, f: 0, fb: 0 }
  const [v, setV] = useState<Record<string, string>>({ name: entry.name, meal: entry.meal, day: date, g: str(entry.g), k: str(n.k), p: str(n.p), c: str(n.c), f: str(n.f), fb: str(n.fb) })
  const set = (k: string, x: string) => setV((o) => ({ ...o, [k]: x }))
  const g = parseNum(v.g) ?? 0
  const save = () => {
    const name = v.name.trim()
    if (!name) { toast("Give the entry a name."); return }
    if (!validDay(v.day)) { toast("Pick a day up to today."); return }
    if (per && !(g > 0)) { toast("Enter an amount in grams."); return }
    const nutr = { k: pos(v.k), p: pos(v.p), c: pos(v.c), f: pos(v.f), fb: pos(v.fb) }
    const next: FoodEntry = per
      ? { id: entry.id, meal: v.meal as Meal, name, g: round1(g), per: nutr }
      : { id: entry.id, meal: v.meal as Meal, name, fixed: nutr }
    if (v.day === date) updateDay(date, (d) => { d.food = d.food.map((x) => (x.id === entry.id ? next : x)) })
    else {
      updateDay(date, (d) => { d.food = d.food.filter((x) => x.id !== entry.id) })
      updateDay(v.day, (d) => { d.food.push(next) })
    }
    toast.success(v.day === date ? "Entry updated" : "Entry moved and updated")
    onDone()
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit food entry</DialogTitle>
        <DialogDescription>{per ? "Change the name, meal, day, amount or nutrition values." : "Change the name, meal, day or values of this quick add."}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <Field id="fe-name" label="Name"><Input id="fe-name" maxLength={80} value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="fe-meal" label="Meal">
            <Select value={v.meal} onValueChange={(m) => set("meal", m)}>
              <SelectTrigger id="fe-meal"><SelectValue /></SelectTrigger>
              <SelectContent>{MEALS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field id="fe-day" label="Day"><Input id="fe-day" type="date" max={today()} value={v.day} onChange={(e) => set("day", e.target.value)} /></Field>
        </div>
        {per && <Field id="fe-g" label="Amount"><UnitInput id="fe-g" unit="g" step="1" value={v.g} onChange={(e) => set("g", e.target.value)} /></Field>}
        <NutritionFields prefix="fe" v={v} set={set} title={per ? "Nutrition per 100 g" : "Nutrition for this entry"} />
        {per && <p className="text-sm">This entry: <b className="tnum">{fmt((pos(v.k) * g) / 100)} kcal</b> · P {fmt((pos(v.p) * g) / 100)} · C {fmt((pos(v.c) * g) / 100)} · F {fmt((pos(v.f) * g) / 100)} g</p>}
      </div>
      <Footer onCancel={onDone} onSave={save} />
    </>
  )
}

/* ---------------- Workout ---------------- */
export function WorkoutEditor({ target, weight, onClose }: { target: { date: string; entry: ExEntry } | null; weight: number; onClose: () => void }) {
  return <Shell open={!!target} onClose={onClose}>{target && <WorkoutForm key={target.entry.id} {...target} weight={weight} onDone={onClose} />}</Shell>
}
function WorkoutForm({ date, entry, weight, onDone }: { date: string; entry: ExEntry; weight: number; onDone: () => void }) {
  const [v, setV] = useState({
    act: EX_INDEX[entry.act] ? entry.act : "other", name: entry.name, day: date,
    min: str(entry.min), km: str(entry.km), kcal: entry.manual || !EX_INDEX[entry.act] ? str(entry.kcal) : "",
  })
  const set = (k: keyof typeof v, x: string) => setV((o) => ({ ...o, [k]: x }))
  const ex = EX_INDEX[v.act]
  const min = parseNum(v.min)
  const manual = parseNum(v.kcal)
  const auto = ex && num(min) ? (ex.met * weight * min) / 60 : null
  const changeAct = (a: string) => setV((o) => ({ ...o, act: a, name: o.name === EX_INDEX[o.act]?.name ? EX_INDEX[a]?.name ?? o.name : o.name }))
  const save = () => {
    if (!num(min) || min <= 0) { toast("Enter the duration in minutes."); return }
    if (!validDay(v.day)) { toast("Pick a day up to today."); return }
    if (!ex && !num(manual)) { toast("Enter the calories for this workout."); return }
    const km = parseNum(v.km)
    const next: ExEntry = {
      id: entry.id, act: v.act, name: v.name.trim() || ex?.name || "Workout", met: ex ? ex.met : null,
      min, km: num(km) ? km : null, kcal: Math.round(num(manual) ? manual : (auto as number)), manual: num(manual),
    }
    if (v.day === date) updateDay(date, (d) => { d.ex = d.ex.map((x) => (x.id === entry.id ? next : x)) })
    else {
      updateDay(date, (d) => { d.ex = d.ex.filter((x) => x.id !== entry.id) })
      updateDay(v.day, (d) => { d.ex.push(next) })
    }
    toast.success("Workout updated")
    onDone()
  }
  return (
    <>
      <DialogHeader><DialogTitle>Edit workout</DialogTitle><DialogDescription>Leave calories empty to estimate them from the activity and your weight.</DialogDescription></DialogHeader>
      <div className="grid gap-4">
        <Field id="we-act" label="Activity">
          <Select value={v.act} onValueChange={changeAct}>
            <SelectTrigger id="we-act"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXERCISES.map(([g, list]) => (
                <SelectGroup key={g}><SelectLabel>{g}</SelectLabel>{list.map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}</SelectGroup>
              ))}
              <SelectGroup><SelectLabel>Other</SelectLabel><SelectItem value="other">Other (enter calories)</SelectItem></SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="we-name" label="Name"><Input id="we-name" maxLength={60} value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field id="we-day" label="Day"><Input id="we-day" type="date" max={today()} value={v.day} onChange={(e) => set("day", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field id="we-min" label="Duration"><UnitInput id="we-min" unit="min" step="1" value={v.min} onChange={(e) => set("min", e.target.value)} /></Field>
          <Field id="we-km" label="Distance"><UnitInput id="we-km" unit="km" step="0.1" placeholder="—" value={v.km} onChange={(e) => set("km", e.target.value)} /></Field>
          <Field id="we-kcal" label="Calories"><UnitInput id="we-kcal" unit="kcal" step="1" placeholder={auto != null ? fmt(auto) : "required"} value={v.kcal} onChange={(e) => set("kcal", e.target.value)} /></Field>
        </div>
        <p className="text-sm">{num(manual) ? <>Using your number: <b>{fmt(manual)} kcal</b></> : auto != null ? <>Estimated: <b>{fmt(auto)} kcal</b></> : <span className="text-muted-foreground">Enter the calories from your watch or app.</span>}</p>
      </div>
      <Footer onCancel={onDone} onSave={save} />
    </>
  )
}

/* ---------------- Weigh-in ---------------- */
export function WeighInEditor({ target, onClose }: { target: { date: string; weight: number; waist: number | null } | null; onClose: () => void }) {
  return <Shell open={!!target} onClose={onClose}>{target && <WeighInForm key={target.date} {...target} onDone={onClose} />}</Shell>
}
function WeighInForm({ date, weight, waist, onDone }: { date: string; weight: number; waist: number | null; onDone: () => void }) {
  const [v, setV] = useState({ day: date, kg: str(weight), waist: str(waist) })
  const save = () => {
    const kg = parseNum(v.kg)
    const w = parseNum(v.waist)
    if (!validDay(v.day)) { toast("Pick a day up to today."); return }
    if (kg == null || kg < 25 || kg > 400) { toast("Enter a weight in kg, for example 68.4"); return }
    if (v.day !== date) updateDay(date, (d) => { d.weight = null; d.waist = null })
    setWeight(v.day, kg, num(w) ? w : null)
    const latest = weightPoints(getState().days).at(-1)
    if (latest?.date === v.day) patchProfile({ weight: round1(kg), ...(num(w) ? { waist: w } : {}) })
    toast.success("Weigh-in updated")
    onDone()
  }
  return (
    <>
      <DialogHeader><DialogTitle>Edit weigh-in</DialogTitle><DialogDescription>Change the day, the weight or the waist measurement.</DialogDescription></DialogHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field id="wi-day" label="Day"><Input id="wi-day" type="date" max={today()} value={v.day} onChange={(e) => setV({ ...v, day: e.target.value })} /></Field>
        <Field id="wi-kg" label="Weight"><UnitInput id="wi-kg" unit="kg" step="0.1" value={v.kg} onChange={(e) => setV({ ...v, kg: e.target.value })} /></Field>
        <Field id="wi-waist" label="Waist"><UnitInput id="wi-waist" unit="cm" step="0.5" placeholder="optional" value={v.waist} onChange={(e) => setV({ ...v, waist: e.target.value })} /></Field>
      </div>
      <Footer onCancel={onDone} onSave={save} />
    </>
  )
}

/* ---------------- Food (create, edit yours, or copy a built-in one) ---------------- */
export type FoodEditTarget = { mode: "new" | "edit" | "copy"; food?: Food }
const CAT_OPTS = CATS.filter(([k]) => k !== "all" && k !== "mine").concat([["mine", "Other"]])
export function FoodEditor({ target, onClose, onSaved }: { target: FoodEditTarget | null; onClose: () => void; onSaved?: (f: Food) => void }) {
  return <Shell open={!!target} onClose={onClose}>{target && <FoodForm key={target.food?.id ?? "new"} {...target} onDone={onClose} onSaved={onSaved} />}</Shell>
}
function FoodForm({ mode, food, onDone, onSaved }: FoodEditTarget & { onDone: () => void; onSaved?: (f: Food) => void }) {
  const [v, setV] = useState<Record<string, string>>({
    name: food ? (mode === "copy" ? `${food.name} (mine)` : food.name) : "", cat: food?.cat && CAT_OPTS.some(([k]) => k === food.cat) ? food.cat : "mine",
    k: str(food?.k), p: str(food?.p), c: str(food?.c), f: str(food?.f), fb: str(food?.fb), sg: str(food?.sg ?? 100), sl: food?.sl ?? "1 serving",
  })
  const set = (k: string, x: string) => setV((o) => ({ ...o, [k]: x }))
  const save = () => {
    const name = v.name.trim()
    const k = parseNum(v.k)
    if (!name) { toast("Give the food a name."); return }
    if (k == null || k < 0 || k > 950) { toast("Enter calories per 100 g (0–950)."); return }
    const sg = parseNum(v.sg)
    const f: Food = {
      id: mode === "edit" && food ? food.id : "u-" + newId(), name, cat: v.cat, k, p: pos(v.p), c: pos(v.c), f: pos(v.f), fb: pos(v.fb),
      sg: sg && sg > 0 ? sg : 100, sl: v.sl.trim() || "1 serving",
    }
    saveFood(f)
    toast.success(mode === "edit" ? `${name} updated` : `${name} saved to your foods`)
    onSaved?.(f)
    onDone()
  }
  const title = mode === "edit" ? "Edit my food" : mode === "copy" ? "Copy to my foods" : "Create a food"
  const desc = mode === "copy" ? "Built-in values stay as they are. Your copy keeps the changes you make here." : "Nutrients per 100 g, as printed on most labels."
  return (
    <>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{desc}</DialogDescription></DialogHeader>
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Field id="fd-name" label="Name"><Input id="fd-name" maxLength={80} placeholder="e.g. Msemen, homemade" value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field id="fd-cat" label="Category">
            <Select value={v.cat} onValueChange={(c) => set("cat", c)}>
              <SelectTrigger id="fd-cat"><SelectValue /></SelectTrigger>
              <SelectContent>{CAT_OPTS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <NutritionFields prefix="fd" v={v} set={set} title="Nutrition per 100 g" />
        <div className="grid grid-cols-2 gap-3">
          <Field id="fd-sg" label="Serving size"><UnitInput id="fd-sg" unit="g" step="any" value={v.sg} onChange={(e) => set("sg", e.target.value)} /></Field>
          <Field id="fd-sl" label="Serving name"><Input id="fd-sl" maxLength={40} placeholder="1 piece" value={v.sl} onChange={(e) => set("sl", e.target.value)} /></Field>
        </div>
      </div>
      <Footer onCancel={onDone} onSave={save} label={mode === "edit" ? "Save changes" : "Save to my foods"} />
    </>
  )
}

/* ---------------- Personal quotes ---------------- */
export function QuotesEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Shell open={open} onClose={onClose}><QuotesForm onDone={onClose} /></Shell>
}
function QuotesForm({ onDone }: { onDone: () => void }) {
  const s = useLedger()
  const mine = s.profile.myQuotes || []
  const [draft, setDraft] = useState<string[]>(mine)
  const [text, setText] = useState("")
  const add = () => {
    const q = text.trim().slice(0, 200)
    if (!q) return
    setDraft([...draft, q])
    setText("")
  }
  const save = () => {
    patchProfile({ myQuotes: draft.map((q) => q.trim()).filter(Boolean) })
    toast.success(s.profileSaved ? "Quotes saved" : "Quotes updated. Save your profile to keep them.")
    onDone()
  }
  return (
    <>
      <DialogHeader><DialogTitle>My quotes</DialogTitle><DialogDescription>Your own lines show up first in the daily rotation, mixed with the built-in ones.</DialogDescription></DialogHeader>
      <div className="grid gap-2">
        {draft.length ? draft.map((q, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input aria-label={`Quote ${i + 1}`} maxLength={200} value={q} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? e.target.value : x)))} />
            <Button variant="ghost" size="icon-sm" aria-label={`Delete quote ${i + 1}`} onClick={() => setDraft(draft.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        )) : <p className="text-sm text-muted-foreground">No personal quotes yet.</p>}
        <div className="flex gap-2 pt-2">
          <Input aria-label="New quote" maxLength={200} placeholder="Write a line that keeps you going" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button variant="secondary" onClick={add}><Plus /> Add</Button>
        </div>
      </div>
      <Footer onCancel={onDone} onSave={save} />
    </>
  )
}
