/* Weight tab additions: plan progress, cycle-aware context, cycle comparison and the calorie check-in. */
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Note, StatTile } from "@/components/shared"
import { CycleOverlayChart } from "@/components/charts"
import { adjustedTargets, CHECK, type Check } from "@/lib/adjust"
import { planOf, planWeight, targetsOf, trendRate, type Metrics, type WeightPoint } from "@/lib/calc"
import { dayInfo, inRetentionWindow, phaseName, typicalSwing, weightByCycle, type CycleCtx } from "@/lib/cycle"
import { DAY_TYPES } from "@/lib/data"
import { addDays, daysBetween, fmtDate, today } from "@/lib/dates"
import { applyCalorieAdjustment, patchProfile } from "@/lib/store"
import type { Profile } from "@/lib/types"
import { clamp, fmt, signed } from "@/lib/utils"

/* ---------- progress against the plan ---------- */
export function ProgressCard({ p, pts, go }: { p: Profile; pts: WeightPoint[]; go: (t: string) => void }) {
  const plan = planOf(p)
  const last = pts[pts.length - 1]
  const t = today()
  if (!plan) {
    return (
      <Card>
        <CardHeader><CardTitle>Progress plan</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          Set a reference weight, goal weight, pace and target date to follow your plan.
          <Button size="sm" variant="secondary" onClick={() => go("metab")}>Open settings</Button>
        </CardContent>
      </Card>
    )
  }
  const dir = plan.goalW < plan.startW ? -1 : 1
  const cur = last?.t ?? null
  const expected = planWeight(plan, t)
  const ahead = cur != null ? (dir < 0 ? expected - cur : cur - expected) : null
  const total = Math.abs(plan.startW - plan.goalW)
  const done = cur != null ? (plan.startW - cur) * -dir : null
  const r21 = trendRate(pts, 21)
  const r28 = trendRate(pts, 28)
  const weeksLeft = plan.goalDate ? daysBetween(t, plan.goalDate) / 7 : null
  const needed = cur != null && weeksLeft && weeksLeft > 0 ? Math.abs(cur - plan.goalW) / weeksLeft : null
  const toward = r21 != null ? r21 * dir : null // positive = moving toward the goal
  const eta = cur != null && toward != null && toward > 0.02 ? addDays(t, Math.round((Math.abs(cur - plan.goalW) / toward) * 7)) : null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress plan</CardTitle>
        <CardDescription>
          From {fmt(plan.startW, 1)} kg on {fmtDate(plan.start, "year")} to {fmt(plan.goalW, 1)} kg{plan.goalDate ? ` by ${fmtDate(plan.goalDate, "year")}` : ""} at {fmt(plan.rate, 2)} kg/week. Paces use the smoothed trend, not single weigh-ins.
        </CardDescription>
        <CardAction>{ahead == null ? null : ahead >= -0.3 ? <Badge variant="good">{ahead >= 0.3 ? "Ahead of plan" : "On plan"}</Badge> : <Badge variant="warn">Behind plan</Badge>}</CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {done != null && (
          <div className="grid gap-1.5">
            <div className="flex justify-between text-[13.5px]"><span>{fmt(Math.max(0, done), 1)} of {fmt(total, 1)} kg</span><span className="tnum">{fmt(clamp((done / total) * 100, 0, 100))}%</span></div>
            <Progress value={clamp((done / total) * 100, 0, 100)} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatTile label="Trend now" value={cur != null ? fmt(cur, 1) : "—"} sub={cur != null ? `plan says ${fmt(expected, 1)} kg today` : "no weigh-ins yet"} />
          <StatTile label="Vs plan" value={ahead != null ? signed(ahead, 1) : "—"} sub={ahead != null ? (ahead >= 0 ? "kg ahead" : "kg behind") : "kg"} />
          <StatTile label="Actual pace" value={r21 != null ? signed(r21, 2) : "—"} sub={r21 != null ? `kg/week, 3 weeks${r28 != null ? ` · 4 weeks ${signed(r28, 2)}` : ""}` : "needs 3 weigh-ins over 10+ days"} />
          <StatTile label="Needed pace" value={needed != null ? fmt(needed, 2) : "—"} sub={needed != null ? `kg/week to reach it by ${fmtDate(plan.goalDate as string)}` : "set a target date"} />
        </div>
        {eta && <p className="text-sm text-muted-foreground">At your current trend pace you would reach {fmt(plan.goalW, 1)} kg around <b className="text-foreground">{fmtDate(eta, "year")}</b>.</p>}
      </CardContent>
    </Card>
  )
}

/* ---------- context for the latest weigh-in ---------- */
export function RetentionNote({ cyc, pts }: { cyc: CycleCtx; pts: WeightPoint[] }) {
  const last = pts[pts.length - 1]
  if (!last || !cyc.recorded.length || daysBetween(last.date, today()) > 3) return null
  const info = dayInfo(cyc, last.date)
  const near = inRetentionWindow(cyc, last.date)
  const lateLuteal = info.phase === "luteal" && cyc.stats.cycleLen != null && info.cycleDay != null && info.cycleDay >= cyc.stats.cycleLen - 6
  if (!(near || info.recorded || lateLuteal) || last.w <= last.a7 + 0.15) return null
  const when = info.recorded ? "during your period" : near ? "in the days just before or at the start of your period" : `in the late ${phaseName("luteal").toLowerCase()} phase`
  return (
    <div className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
      Your latest weigh-in ({fmt(last.w, 1)} kg, {fmtDate(last.date)}) is {fmt(last.w - last.a7, 1)} kg above your 7-day average and falls {when}.
      Water retention often adds 0.5–2 kg at this time and usually goes away within a few days after the period starts. This is not counted as fat gain:
      the reading is kept exactly as you entered it, and your trend and cycle-to-cycle averages are what show real change.
    </div>
  )
}

/* ---------- weight across cycles ---------- */
export function CycleWeightCard({ cyc, pts, go }: { cyc: CycleCtx; pts: WeightPoint[]; go: (t: string) => void }) {
  const rows = weightByCycle(cyc, pts)
  const swing = typicalSwing(cyc, pts)
  const withData = rows.filter((r) => r.n >= 3)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weight across your cycles</CardTitle>
        <CardDescription>Comparing whole cycles, start to start, cancels out most of the water swings inside each one.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!cyc.recorded.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            Record your periods to see them on the weight chart and to compare cycles.
            <Button size="sm" variant="secondary" onClick={() => go("cycle")}>Cycle Tracking</Button>
          </div>
        ) : (
          <>
            {withData.length > 0 && <CycleOverlayChart cycles={rows} />}
            {withData.length > 0 && <p className="text-xs text-muted-foreground">Each line is one cycle: weigh-ins by cycle day (day 1 = first day of the period), shown as the difference from that cycle's average weight. Recorded weights are not changed.</p>}
            <Table>
              <TableHeader><TableRow><TableHead>Cycle</TableHead><TableHead className="text-right">Days</TableHead><TableHead className="text-right">Weigh-ins</TableHead><TableHead className="text-right">Average kg</TableHead><TableHead className="text-right">Low – high</TableHead><TableHead className="text-right">Vs previous</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...rows].reverse().map((r) => {
                  const i = rows.indexOf(r)
                  const prev = rows.slice(0, i).reverse().find((x) => x.avg != null && x.n >= 3)
                  return (
                    <TableRow key={r.start}>
                      <TableCell>{fmtDate(r.start, "year")}{!r.complete && <span className="ml-1.5 text-xs text-muted-foreground">current</span>}</TableCell>
                      <TableCell className="text-right">{r.len}</TableCell>
                      <TableCell className="text-right">{r.n}</TableCell>
                      <TableCell className="text-right font-bold">{r.avg != null ? fmt(r.avg, 1) : "—"}</TableCell>
                      <TableCell className="text-right">{r.min != null ? `${fmt(r.min, 1)} – ${fmt(r.max, 1)}` : "—"}</TableCell>
                      <TableCell className="text-right">{r.avg != null && r.n >= 3 && prev?.avg != null ? signed(r.avg - prev.avg, 1) : "—"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {swing && (
              <Note>
                In your own data, weigh-ins from 5 days before to day 3 of your period were on average <b>{signed(swing.kg, 1)} kg</b> compared with earlier in the same cycle ({swing.cycles} cycle{swing.cycles === 1 ? "" : "s"}).
                {swing.kg > 0.2 ? " That rise is most likely water and tends to reverse after your period." : ""}
              </Note>
            )}
          </>
        )}
        <WhyItFluctuates />
      </CardContent>
    </Card>
  )
}

function WhyItFluctuates() {
  return (
    <details className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-bold">Why weight can rise around your period</summary>
      <ul className="mt-2 grid gap-1.5 pl-4 text-muted-foreground [&>li]:list-disc">
        <li>In the second half of the cycle (luteal phase), changes in progesterone and oestrogen can make the body hold more water and sodium. Many people see 0.5–2 kg more on the scale in the days before and at the start of a period.</li>
        <li>Bloating, slower digestion, cravings or a little more salt and carbohydrate can add to it. Stored carbohydrate (glycogen) holds water too.</li>
        <li>This weight usually drops again within a few days after bleeding starts. Gaining 1 kg of fat would take an extra ~7,700 kcal, which a few days of normal eating do not provide.</li>
        <li>So the app never treats a rise during this time as fat gain, never subtracts an estimated amount of water from your readings, and does not suggest lowering calories because of it. Look at the trend line, the 7-day average and the comparison between cycles instead.</li>
        <li>Fluctuations can vary a lot between people and cycles. If your cycle changes suddenly or weight changes are large and lasting, talk to a doctor.</li>
      </ul>
    </details>
  )
}

/* ---------- calorie check-in ---------- */
export function CalorieCheckCard({ check, p, M }: { check: Check; p: Profile; M: Metrics }) {
  const [open, setOpen] = useState(false)
  const canApply = M.mode === "daytype" || (M.mode === "custom" && p.customKcal != null)
  const after = check.delta ? adjustedTargets(p, check.delta) : null
  const meter = (label: string, have: number, need: number) => (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-[13.5px]"><span>{label}</span><span className="tnum"><b>{Math.min(have, need)}</b> / {need}</span></div>
      <Progress value={(have / need) * 100} />
    </div>
  )
  const badge = { learning: <Badge variant="accent">Collecting data</Badge>, "on-track": <Badge variant="good">On track</Badge>, hold: <Badge variant="secondary">No change</Badge>, suggest: <Badge variant="warn">Suggestion</Badge>, snoozed: <Badge variant="secondary">Snoozed</Badge> }[check.status]
  const apply = () => {
    if (!check.delta) return
    const note = `Trend ${signed(check.actualRate, 2)} kg/week vs target ${signed(check.targetRate, 2)} over ${fmtDate(check.windowStart)}–${fmtDate(check.windowEnd)}`
    applyCalorieAdjustment(check.delta, note, after ?? undefined)
    setOpen(false)
    toast.success(`Targets ${check.delta > 0 ? "raised" : "lowered"} by ${Math.abs(check.delta)} kcal. Next check in 3 weeks.`)
  }
  const snooze = () => { patchProfile({ adjSnoozeUntil: addDays(today(), 7) }); setOpen(false); toast("Hidden for a week. Your targets were not changed.") }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calorie check-in</CardTitle>
        <CardDescription>Every 3–4 weeks, your intake and weight trend are compared with your plan. Targets never change without your confirmation.</CardDescription>
        <CardAction>{badge}</CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm">{check.message}</p>
        {check.status === "snoozed" && <div><Button size="sm" variant="outline" onClick={() => patchProfile({ adjSnoozeUntil: null })}>Show now</Button></div>}
        {check.status === "learning" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {meter("Complete food days", check.completeDays, check.needComplete)}
            {meter("Weigh-ins", check.weighIns, CHECK.minWeighIns)}
            {meter("Days between weigh-ins", check.span, CHECK.minSpan)}
          </div>
        ) : check.actualRate != null && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile label="Trend pace" value={signed(check.actualRate, 2)} sub={`kg/week · target ${signed(check.targetRate, 2)}`} />
            <StatTile label="Average eaten" value={fmt(check.avgIntake)} sub={`kcal on ${check.completeDays} complete days`} />
            <StatTile label="Average target" value={fmt(check.avgTarget)} sub="kcal on the same days" />
            <StatTile label="Training" value={fmt(check.trainingPerWeek, 1)} sub="gym or run days / week" />
          </div>
        )}
        {check.cycleAware && <p className="text-xs text-muted-foreground">{check.excludedReadings} weigh-in{check.excludedReadings === 1 ? "" : "s"} from the days around your period were left out of this pace (water retention). They stay in your history unchanged.</p>}
        {check.notes.map((n) => <Note key={n}>{n}</Note>)}
        {check.status === "suggest" && check.delta && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpen(true)}>Review {check.delta > 0 ? "+" : "−"}{Math.abs(check.delta)} kcal</Button>
            <Button variant="ghost" onClick={snooze}>Not now</Button>
          </div>
        )}
        {p.adjustments?.length ? (
          <p className="text-xs text-muted-foreground">Last change: {signed(p.adjustments[p.adjustments.length - 1].delta, 0)} kcal on {fmtDate(p.adjustments[p.adjustments.length - 1].date, "year")}.</p>
        ) : null}
        <p className="text-xs text-muted-foreground">Needs at least 3 weeks with {Math.round(CHECK.completeShare * 100)}% of days fully logged and {CHECK.minWeighIns}+ weigh-ins. Short-term swings, a single week, or eating above target never lead to a lower target. Changes are capped at {CHECK.maxStep} kcal and targets never go below {CHECK.floor} kcal.</p>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply {check.delta && check.delta > 0 ? "+" : "−"}{Math.abs(check.delta || 0)} kcal a day?</DialogTitle>
            <DialogDescription>{check.message} The change goes to carbohydrates; protein, fat and fibre stay the same. Your logged meals are not changed.</DialogDescription>
          </DialogHeader>
          {M.mode === "daytype" && after ? (
            <Table>
              <TableHeader><TableRow><TableHead>Day</TableHead><TableHead className="text-right">Now</TableHead><TableHead className="text-right">After</TableHead><TableHead className="text-right">Carbs</TableHead></TableRow></TableHeader>
              <TableBody>
                {DAY_TYPES.map(([k, l]) => (
                  <TableRow key={k}>
                    <TableCell>{l}</TableCell>
                    <TableCell className="text-right">{fmt(targetsOf(p, k).k)} kcal</TableCell>
                    <TableCell className="text-right font-bold">{fmt(after[k].k)} kcal</TableCell>
                    <TableCell className="text-right">{fmt(targetsOf(p, k).c)} → {fmt(after[k].c)} g</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : M.mode === "custom" && p.customKcal != null ? (
            <p className="text-sm">Custom target: {fmt(p.customKcal)} → <b>{fmt(p.customKcal + (check.delta || 0))} kcal</b></p>
          ) : (
            <Note tone="warn">Your calorie target is calculated ({M.mode}). Switch to “By day type” or “Custom” in Metabolism to apply a change.</Note>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={snooze}>Not now</Button>
            <Button disabled={!canApply} onClick={apply}>Apply change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
