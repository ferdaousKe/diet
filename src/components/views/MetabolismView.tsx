import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Banners, Note, NumberField, SelectField, type ViewProps } from "@/components/shared"
import { bfCat, bmiCat, macroTargets, metrics, weightPoints } from "@/lib/calc"
import { ACTIVITY } from "@/lib/data"
import { ageFrom, fmtDate, today } from "@/lib/dates"
import { patchProfile, saveProfileFirst, setWeight } from "@/lib/store"
import type { Profile } from "@/lib/types"
import { clamp, cn, fmt } from "@/lib/utils"

export function MetabolismView({ s, go }: ViewProps) {
  const p = s.profile
  const saved = s.profileSaved
  const [wOverride, setWOverride] = useState<number | null>(null)
  const M = metrics(p, s.days, { profileSaved: saved, weightOverride: wOverride })
  const lw = weightPoints(s.days).at(-1)?.w ?? null
  const wVal = saved && lw != null ? lw : p.weight
  const hasMeas = [p.neck, p.waist, p.hip, p.bodyFat].some((v) => v != null)

  // Live edits update the profile; they are saved on blur/select once the profile exists.
  const edit = (patch: Partial<Profile>) => patchProfile(patch, false)
  const commit = (patch: Partial<Profile>) => patchProfile(patch, true)
  const seg = <K extends keyof Profile>(key: K, opts: [string, string][], label: string, hint?: ReactNode) => (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <ToggleGroup
        type="single"
        value={String(p[key])}
        onValueChange={(v) => {
          if (!v) return
          const patch = { [key]: v } as Partial<Profile>
          if (key === "goal" && v === "gain" && p.rate > 0.5) patch.rate = 0.25
          commit(patch)
        }}
      >
        {opts.map(([v, l]) => <ToggleGroupItem key={v} value={v}>{l}</ToggleGroupItem>)}
      </ToggleGroup>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )

  const saveFirst = () => {
    if (!(p.height && p.height >= 100 && p.height <= 250)) { toast("Enter your height in cm."); return }
    if (!(p.weight && p.weight >= 25 && p.weight <= 400)) { toast("Enter your current weight in kg."); return }
    if (!ageFrom(p.dob)) { toast("Enter your date of birth."); return }
    saveProfileFirst()
    if (lw == null) setWeight(today(), p.weight)
    toast.success(s.conn === "cloud" ? "Profile saved. Your journey starts now!" : "Profile saved in this browser.")
  }
  const rates: [string, string][] = p.goal === "gain"
    ? [["0.25", "0.25 kg/week · lean gain"], ["0.5", "0.5 kg/week"]]
    : [["0.25", "0.25 kg/week · gentle"], ["0.5", "0.5 kg/week · steady"], ["0.75", "0.75 kg/week · fast"], ["1", "1 kg/week · aggressive"]]
  const actRow = ACTIVITY.find((a) => a[0] === p.activity) || ACTIVITY[1]

  return (
    <div className="grid gap-5">
      <Banners s={s} go={go} onMetab />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardAction>{saved ? <Badge variant="good">{s.conn === "cloud" ? "Saved to your account" : "Saved"}</Badge> : <Badge variant="warn">Example values</Badge>}</CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!saved && <Note tone="warn">These are example values. Replace them with yours, then press “Save my profile”.</Note>}
            {seg("sex", [["female", "Female"], ["male", "Male"]], "Sex")}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="p-dob">Date of birth</Label>
                <Input id="p-dob" type="date" max={today()} value={p.dob || ""} onChange={(e) => edit({ dob: e.target.value })} onBlur={(e) => commit({ dob: e.target.value })} />
              </div>
              <NumberField id="p-height" label="Height" unit="cm" step="0.5" value={p.height} onChange={(v) => edit({ height: v })} onCommit={(v) => commit({ height: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id="p-weight" label="Current weight" unit="kg" step="0.1" value={wVal}
                onChange={(v) => (saved ? setWOverride(v) : edit({ weight: v }))}
                onCommit={(v) => {
                  if (!saved) return
                  setWOverride(null)
                  if (v != null && v >= 25 && v <= 400 && v !== lw) { setWeight(today(), v); commit({ weight: Math.round(v * 10) / 10 }) }
                }}
              />
              <NumberField id="p-goal" label="Goal weight" unit="kg" step="0.1" value={p.goalWeight} onChange={(v) => edit({ goalWeight: v })} onCommit={(v) => commit({ goalWeight: v })} />
            </div>
            {saved && <p className="-mt-2 text-xs text-muted-foreground">Changing your current weight here logs it as today's weigh-in.</p>}
            <SelectField
              id="p-activity" label="Daily activity" value={String(p.activity)}
              options={ACTIVITY.map(([f, n]) => [String(f), n])}
              onChange={(v) => commit({ activity: Number(v) })}
              hint={`${actRow[2]}. Count daily life only: the workouts you log are added on top.`}
            />
            <Fold title="Body measurements" hint="optional" defaultOpen={hasMeas}>
              <div className="grid grid-cols-3 gap-3">
                <NumberField id="p-neck" label="Neck" unit="cm" step="0.5" value={p.neck} onChange={(v) => edit({ neck: v })} onCommit={(v) => commit({ neck: v })} />
                <NumberField id="p-waist" label="Waist" unit="cm" step="0.5" value={p.waist} onChange={(v) => edit({ waist: v })} onCommit={(v) => commit({ waist: v })} />
                <NumberField id="p-hip" label="Hips" unit="cm" step="0.5" value={p.hip} onChange={(v) => edit({ hip: v })} onCommit={(v) => commit({ hip: v })} />
              </div>
              <p className="text-xs text-muted-foreground">Neck below the larynx, waist at the navel, hips at the widest point.</p>
              <NumberField id="p-bf" label="Known body fat" unit="%" step="0.1" value={p.bodyFat} onChange={(v) => edit({ bodyFat: v })} onCommit={(v) => commit({ bodyFat: v })} hint="From a scan or smart scale. Leave empty to use the tape measurements." />
            </Fold>

            <div className="border-t pt-4 font-display text-lg font-semibold">Plan</div>
            {seg("goal", [["lose", "Lose weight"], ["maintain", "Maintain"], ["gain", "Gain"]], "Goal")}
            {p.goal !== "maintain" && <SelectField id="p-rate" label="Pace" value={String(p.rate)} options={rates} onChange={(v) => commit({ rate: Number(v) })} />}
            {seg("targetMode", [["formula", "Formula"], ["adaptive", "Adaptive"], ["custom", "Custom"]], "Calorie target",
              { formula: "BMR × activity, adjusted for your goal.", adaptive: "Learns your real burn from your food log and weight trend.", custom: "Set your own number." }[p.targetMode])}
            {p.targetMode === "custom" && <NumberField id="p-custom" label="Custom target" unit="kcal" step="10" value={p.customKcal} onChange={(v) => edit({ customKcal: v })} onCommit={(v) => commit({ customKcal: v })} />}
            <Fold title="Water & activity goals" defaultOpen={p.waterGoal != null || p.exGoal !== 150}>
              <div className="grid grid-cols-2 gap-3">
                <NumberField id="p-water" label="Daily water" unit="ml" step="50" value={p.waterGoal} placeholder={fmt(M.waterAuto)} onChange={(v) => edit({ waterGoal: v })} onCommit={(v) => commit({ waterGoal: v != null && v >= 250 ? v : null })} hint={`Empty = automatic (35 ml/kg ≈ ${fmt(M.waterAuto)} ml)`} />
                <NumberField id="p-exgoal" label="Weekly activity" unit="min" step="10" value={p.exGoal} onChange={(v) => edit({ exGoal: v ?? 150 })} onCommit={(v) => commit({ exGoal: v != null && v > 0 ? v : 150 })} hint="WHO minimum: 150 min" />
              </div>
            </Fold>
            <Fold title="Advanced settings">
              <SelectField id="p-bmr" label="BMR formula" value={p.bmrFormula} onChange={(v) => commit({ bmrFormula: v as Profile["bmrFormula"] })}
                options={[["mifflin", "Mifflin-St Jeor (recommended)"], ["harris", "Harris-Benedict, revised"], ["katch", "Katch-McArdle (lean mass)"], ["cunningham", "Cunningham (athletes)"]]} />
              <SelectField id="p-protein" label="Protein" value={String(p.proteinPerKg)} onChange={(v) => commit({ proteinPerKg: Number(v) })}
                options={[["1.2", "1.2 g/kg · minimum when active"], ["1.6", "1.6 g/kg"], ["1.8", "1.8 g/kg · default"], ["2", "2.0 g/kg"], ["2.2", "2.2 g/kg · heavy strength training"]]} />
              <SelectField id="p-fat" label="Fat share" value={String(p.fatPct)} onChange={(v) => commit({ fatPct: Number(v) })}
                options={[["20", "20% of calories"], ["25", "25%"], ["30", "30% · default"], ["35", "35%"]]} />
              <SelectField id="p-credit" label="Add workout calories to budget" value={String(p.exCredit)} onChange={(v) => commit({ exCredit: Number(v) })}
                options={[["0", "Off"], ["0.5", "50% · recommended"], ["0.75", "75%"], ["1", "100%"]]} hint="MET estimates usually run high, so adding back half is safer." />
            </Fold>
            {saved ? (
              <p className="text-xs text-muted-foreground">{s.conn === "cloud" ? "Changes save automatically to your account." : "Changes save automatically in this browser."}</p>
            ) : <Button size="lg" onClick={saveFirst}>Save my profile</Button>}
          </CardContent>
        </Card>

        <Results M={M} saved={saved} usingTrend={saved && M.tw != null && wOverride == null} />
      </div>
    </div>
  )
}

function Fold({ title, hint, defaultOpen, children }: { title: string; hint?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-3">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-left font-bold">
        <span>{title}{hint && <span className="ml-2 text-xs font-semibold text-muted-foreground">{hint}</span>}</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-3 pt-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function KV({ k, sub, children }: { k: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-2.5 last:border-0">
      <span className="min-w-0">{k}{sub && <small className="block text-xs text-muted-foreground">{sub}</small>}</span>
      <b className="text-right whitespace-nowrap tnum">{children}</b>
    </div>
  )
}

function Results({ M, saved, usingTrend }: { M: ReturnType<typeof metrics>; saved: boolean; usingTrend: boolean }) {
  const mt = macroTargets(M.target, M)
  const kc = { p: mt.p * 4, c: mt.c * 4, f: mt.f * 9 }
  const tot = kc.p + kc.c + kc.f || 1
  const goalTxt = M.sign < 0 ? `to lose ${M.rate} kg/week` : M.sign > 0 ? `to gain ${M.rate} kg/week` : ""
  const deltaTxt = M.delta ? `${M.delta < 0 ? "−" : "+"} ${fmt(Math.abs(M.delta))} ${goalTxt}` : "(maintenance)"
  const floorTxt = M.clamped ? `, raised to the ${fmt(M.floor)} kcal floor` : ""
  const calc = M.mode === "custom"
    ? `Your own number. The formula would give ${fmt(Math.max(M.floor, M.tdee + M.delta))} kcal.`
    : M.mode === "adaptive"
      ? `Measured burn ${fmt(M.ad.tdee)}${M.credit && M.ad.avgEx ? ` − workout credit ${fmt(M.credit * M.ad.avgEx)}` : ""} ${deltaTxt}${floorTxt}`
      : `BMR ${fmt(M.BMR)} × activity ${M.act} = TDEE ${fmt(M.tdee)} ${deltaTxt}${floorTxt}`
  const [bc, bTone] = bmiCat(M.bmi)
  const [fc, fTone] = bfCat(M.bf, M.male)
  const whtrCat = M.whtr == null ? null : M.whtr < 0.5 ? (["Healthy", "good"] as const) : M.whtr < 0.6 ? (["Increased risk", "warn"] as const) : (["High risk", "bad"] as const)
  const whrCat = M.whr == null ? null : M.male
    ? M.whr <= 0.95 ? (["Low risk", "good"] as const) : M.whr <= 1 ? (["Moderate risk", "warn"] as const) : (["High risk", "bad"] as const)
    : M.whr <= 0.8 ? (["Low risk", "good"] as const) : M.whr <= 0.85 ? (["Moderate risk", "warn"] as const) : (["High risk", "bad"] as const)
  const bmiPos = clamp(((M.bmi - 15) / 25) * 100, 0, 100)
  const BMR_ROWS: [keyof typeof M.bmr, string, string][] = [
    ["mifflin", "Mifflin-St Jeor", "Most accurate for most people"], ["harris", "Harris-Benedict (revised)", "Classic formula, runs a little high"],
    ["katch", "Katch-McArdle", "Uses lean mass"], ["cunningham", "Cunningham", "Uses lean mass, suits athletes"],
  ]

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardDescription className="text-[11px] font-extrabold tracking-[0.1em] uppercase">Daily calorie target · {{ formula: "Formula", adaptive: "Adaptive", custom: "Custom" }[M.mode]}</CardDescription>
          {!saved && <CardAction><Badge variant="warn">Example</Badge></CardAction>}
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[clamp(48px,8vw,68px)] leading-none font-semibold text-primary tnum">{fmt(M.target)}</span>
            <span className="text-sm font-bold text-muted-foreground">kcal / day</span>
          </div>
          <p className="text-sm text-muted-foreground tnum">{calc}</p>
          {M.modeNote && <Note>{M.modeNote}</Note>}
          {M.clamped && <Note tone="warn">Your target is held at {fmt(M.floor)} kcal, the usual minimum without medical supervision. A slower pace gives a target above this floor.</Note>}
          {M.rateHigh && <Note tone="warn">{M.rate} kg per week is more than 1% of your body weight. A slower pace protects muscle and is easier to keep up.</Note>}
          {M.goalBmi != null && M.goalBmi < 18.5 && <Note tone="warn">Your goal weight gives a BMI of {fmt(M.goalBmi, 1)}, below the healthy range of 18.5–24.9. A goal of at least {fmt(M.healthy[0], 1)} kg keeps you in it.</Note>}
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            <i style={{ flex: kc.p, background: "var(--protein)" }} /><i style={{ flex: kc.c, background: "var(--carbs)" }} /><i style={{ flex: kc.f, background: "var(--fat)" }} />
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Macro</TableHead><TableHead className="text-right">Grams</TableHead><TableHead className="text-right">kcal</TableHead><TableHead className="text-right">Share</TableHead></TableRow></TableHeader>
            <TableBody>
              {([["protein", "Protein", mt.p, kc.p], ["carbs", "Carbohydrates", mt.c, kc.c], ["fat", "Fat", mt.f, kc.f]] as [string, string, number, number][]).map(([c, n, g, k]) => (
                <TableRow key={c}><TableCell><i className="mr-2 inline-block size-2.5 rounded-full" style={{ background: `var(--${c})` }} />{n}</TableCell><TableCell className="text-right">{fmt(g)} g</TableCell><TableCell className="text-right">{fmt(k)}</TableCell><TableCell className="text-right">{fmt((k / tot) * 100)}%</TableCell></TableRow>
              ))}
              <TableRow><TableCell><i className="mr-2 inline-block size-2.5 rounded-full" style={{ background: "var(--fiber)" }} />Fiber</TableCell><TableCell className="text-right">{fmt(mt.fb)} g</TableCell><TableCell className="text-right">—</TableCell><TableCell className="text-right">—</TableCell></TableRow>
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Protein: {M.proteinPerKg} g per kg of {M.refAdjusted ? "adjusted body weight (weight at BMI 25)" : "body weight"}. Fat: {M.fatPct}% of calories. Carbs fill the rest. Fiber: 14 g per 1,000 kcal.
            {usingTrend ? ` Calculated with your trend weight of ${fmt(M.w, 1)} kg, so the target adapts as you go.` : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Energy expenditure</CardTitle><CardDescription>BMR is what your body burns at complete rest. Tap a formula to use it.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1">
            {BMR_ROWS.map(([k, n, d]) => (
              <button
                key={k}
                onClick={() => patchProfile({ bmrFormula: k })}
                aria-pressed={M.bmrKey === k}
                className={cn("flex cursor-pointer items-baseline justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary", M.bmrKey === k && "bg-secondary ring-1 ring-primary/40")}
              >
                <span>{n}<small className="block text-xs text-muted-foreground">{d}{M.bmrKey === k ? " · in use" : ""}</small></span>
                <b className="tnum">{fmt(M.bmr[k])} kcal</b>
              </button>
            ))}
          </div>
          <b className="text-sm">TDEE by activity level</b>
          <Table>
            <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead className="text-right">Factor</TableHead><TableHead className="text-right">kcal / day</TableHead></TableRow></TableHeader>
            <TableBody>
              {ACTIVITY.map(([f, n]) => (
                <TableRow key={f} data-state={f === M.act ? "selected" : undefined}><TableCell>{n}</TableCell><TableCell className="text-right">× {f}</TableCell><TableCell className="text-right">{fmt(M.BMR * f)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid items-start gap-5 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Body composition</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <span className="text-[11px] font-extrabold tracking-[0.08em] text-muted-foreground uppercase">Body mass index</span>
              <div className="flex flex-wrap items-baseline gap-2.5"><b className="font-display text-4xl font-semibold tnum">{fmt(M.bmi, 1)}</b><Badge variant={bTone}>{bc}</Badge></div>
            </div>
            <div className="pt-2">
              <div className="relative flex h-2.5 gap-0.5">
                <span className="rounded-l-full" style={{ flex: 3.5, background: "var(--fat)" }} />
                <span style={{ flex: 6.5, background: "var(--good)" }} />
                <span style={{ flex: 5, background: "var(--warn)" }} />
                <span className="rounded-r-full" style={{ flex: 10, background: "var(--bad)" }} />
                <i className="absolute -top-1.5 h-[22px] w-1.5 -translate-x-1/2 rounded border-2 border-card bg-foreground" style={{ left: `${bmiPos}%` }} />
              </div>
              <div className="relative h-5 text-[10.5px] font-bold text-muted-foreground">
                {[["14%", "18.5"], ["40%", "25"], ["60%", "30"], ["80%", "35"]].map(([l, v]) => <span key={v} className="absolute top-1 -translate-x-1/2" style={{ left: l }}>{v}</span>)}
              </div>
            </div>
            <div>
              <KV k="Body fat" sub={M.bfMethod}><span className="mr-2">{fmt(M.bf, 1)}%</span><Badge variant={fTone}>{fc}</Badge></KV>
              <KV k="Lean mass">{fmt(M.lbm, 1)} kg</KV>
              <KV k="Fat mass">{fmt(M.fatMass, 1)} kg</KV>
              <KV k="FFMI" sub="Lean mass index, height-adjusted">{fmt(M.ffmiN, 1)}</KV>
            </div>
            {M.bfEst && <p className="text-xs text-muted-foreground">Add neck, waist and hip measurements for a better body-fat estimate.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Weight ranges</CardTitle></CardHeader>
          <CardContent>
            <KV k="Healthy range" sub={`BMI 18.5–24.9 at ${fmt(M.h)} cm`}>{fmt(M.healthy[0], 1)}–{fmt(M.healthy[1], 1)} kg</KV>
            {Object.entries(M.ideal).map(([n, v]) => <KV key={n} k={n} sub="Ideal body weight formula">{fmt(v, 1)} kg</KV>)}
            <div className="mt-3 border-t pt-3 font-display text-base font-semibold">Your goal</div>
            <KV k="Goal weight">{M.goalW != null ? `${fmt(M.goalW, 1)} kg` : "—"}</KV>
            <KV k="BMI at goal">{M.goalBmi != null ? fmt(M.goalBmi, 1) : "—"}</KV>
            <KV k="Time to goal" sub={M.eta ? `${fmt(M.eta.kg, 1)} kg at ${M.rate} kg/week` : M.sign === 0 ? "Goal set to maintain" : "Already there, or no goal set"}>{M.eta ? `${fmt(M.eta.weeks)} weeks` : "—"}</KV>
            {M.eta && <KV k="Expected date">{fmtDate(M.eta.date, "year")}</KV>}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-5 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Measurements</CardTitle></CardHeader>
          <CardContent>
            <KV k="Waist-to-height ratio" sub="Healthy below 0.5">{whtrCat ? <><span className="mr-2">{fmt(M.whtr, 2)}</span><Badge variant={whtrCat[1]}>{whtrCat[0]}</Badge></> : "—"}</KV>
            <KV k="Waist-to-hip ratio" sub={M.male ? "Low risk at 0.95 or below" : "Low risk at 0.80 or below"}>{whrCat ? <><span className="mr-2">{fmt(M.whr, 2)}</span><Badge variant={whrCat[1]}>{whrCat[0]}</Badge></> : "—"}</KV>
            {M.whtr == null && <p className="pt-2 text-xs text-muted-foreground">Add your waist (and hips) under Body measurements to see these ratios.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Daily needs</CardTitle></CardHeader>
          <CardContent>
            <KV k="Water" sub="35 ml per kg, more when you train">{fmt(M.water / 1000, 2)} L</KV>
            <KV k="Protein range" sub="1.6–2.2 g/kg for keeping muscle">{fmt(1.6 * M.refW)}–{fmt(2.2 * M.refW)} g</KV>
            <KV k="Fiber">{fmt(mt.fb)} g</KV>
            <KV k="Max heart rate" sub="Tanaka formula">{M.maxHR} bpm</KV>
          </CardContent>
        </Card>
      </div>
      <p className="text-center text-xs text-muted-foreground">All values are estimates from population formulas. They are a starting point, not a medical assessment.</p>
    </div>
  )
}
