import { useState } from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { WeighInEditor } from "@/components/editors"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Banners, ConfirmDelete, QuoteLine, StatTile, UnitInput, type ViewProps } from "@/components/shared"
import { WeightChart } from "@/components/charts"
import { weightPoints, type Metrics } from "@/lib/calc"
import { addDays, daysBetween, fmtDate, today } from "@/lib/dates"
import { getState, patchProfile, setWeight, updateDay } from "@/lib/store"
import { fmt, num, parseNum, signed, slope } from "@/lib/utils"

export function WeightView({ s, M, go }: ViewProps) {
  const [wdate, setWdate] = useState(today())
  const [wkg, setWkg] = useState("")
  const [wwaist, setWwaist] = useState("")
  const [range, setRange] = useState("90")
  const [editW, setEditW] = useState<{ date: string; weight: number; waist: number | null } | null>(null)
  const pts = weightPoints(s.days)
  const first = pts[0]
  const last = pts[pts.length - 1]
  const since = addDays(today(), -20)
  const recent = pts.filter((p) => p.date >= since).map((p) => [daysBetween(since, p.date), p.w] as [number, number])
  const rate = recent.length >= 2 && recent[recent.length - 1][0] - recent[0][0] >= 5 ? slope(recent) * 7 : null
  const toGoal = last && M.goalW ? last.t - M.goalW : null

  const log = () => {
    const kg = parseNum(wkg)
    const waist = parseNum(wwaist)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wdate) || wdate > today()) { toast("Pick a date up to today."); return }
    if (kg == null || kg < 25 || kg > 400) { toast("Enter a weight in kg, for example 68.4"); return }
    setWeight(wdate, kg, num(waist) ? waist : s.days[wdate]?.waist ?? null)
    const latest = weightPoints(getState().days).at(-1)
    if (latest && latest.date === wdate) patchProfile({ weight: Math.round(kg * 10) / 10, ...(num(waist) ? { waist } : {}) })
    setWkg(""); setWwaist("")
    toast.success(last && kg < last.w && M.sign < 0 ? "Saved. Trust the trend, you're moving." : "Weigh-in saved. Trust the trend, not one reading.")
  }

  return (
    <div className="grid gap-5">
      <Banners s={s} go={go} />
      <WeighInEditor target={editW} onClose={() => setEditW(null)} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Log a weigh-in</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5"><Label htmlFor="wdate">Date</Label><Input id="wdate" type="date" max={today()} value={wdate} onChange={(e) => setWdate(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label htmlFor="wkg">Weight</Label><UnitInput id="wkg" unit="kg" step="0.1" placeholder={last ? fmt(last.w, 1) : "68.4"} value={wkg} onChange={(e) => setWkg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && log()} /></div>
              <div className="grid gap-1.5"><Label htmlFor="wwaist">Waist</Label><UnitInput id="wwaist" unit="cm" step="0.5" placeholder="optional" value={wwaist} onChange={(e) => setWwaist(e.target.value)} onKeyDown={(e) => e.key === "Enter" && log()} /></div>
            </div>
            <Button onClick={log}>Save weigh-in</Button>
            <p className="text-sm text-muted-foreground">Weigh yourself in the morning, after the bathroom and before eating. Swings of 0.5–1 kg from day to day are mostly water. Your calorie target follows the smoothed trend, not single readings.</p>
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile label="Trend weight" value={last ? fmt(last.t, 1) : "—"} sub={last ? `last reading ${fmt(last.w, 1)} kg` : "no data yet"} />
              <StatTile label="Since start" value={first && last ? signed(last.t - first.w) : "—"} sub={first ? `from ${fmt(first.w, 1)} kg on ${fmtDate(first.date)}` : "kg"} />
              <StatTile label="Pace" value={rate != null ? signed(rate, 2) : "—"} sub={rate != null ? "kg / week, last 3 weeks" : "needs 2 weigh-ins over 5+ days"} />
              <StatTile label="To goal" value={toGoal != null ? fmt(Math.abs(toGoal), 1) : "—"} sub={toGoal != null ? (M.eta ? `kg · about ${fmtDate(M.eta.date, "year")}` : "kg") : "set a goal weight"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trend</CardTitle>
            <CardAction>
              <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v)} aria-label="Range">
                <ToggleGroupItem value="30">30 d</ToggleGroupItem>
                <ToggleGroupItem value="90">90 d</ToggleGroupItem>
                <ToggleGroupItem value="365">1 y</ToggleGroupItem>
                <ToggleGroupItem value="0">All</ToggleGroupItem>
              </ToggleGroup>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            <WeightChart points={pts} range={Number(range)} goal={M.goalW} />
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i className="h-[3px] w-4 rounded-full bg-primary" />Trend</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-muted-foreground/60" />Daily readings</span>
              {M.goalW != null && <span className="flex items-center gap-1.5"><i className="h-[3px] w-4 rounded-full bg-good" />Goal</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      <AdaptiveCard M={M} using={s.profile.targetMode === "adaptive"} />

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent>
          {pts.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Weight kg</TableHead><TableHead className="text-right">Trend</TableHead><TableHead className="text-right">Change</TableHead><TableHead className="text-right">Waist cm</TableHead><TableHead><span className="sr-only">Delete</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {[...pts].reverse().map((p, i, arr) => (
                  <TableRow key={p.date}>
                    <TableCell>{fmtDate(p.date, "year")}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(p.w, 1)}</TableCell>
                    <TableCell className="text-right">{fmt(p.t, 1)}</TableCell>
                    <TableCell className="text-right">{arr[i + 1] ? signed(p.w - arr[i + 1].w) : "—"}</TableCell>
                    <TableCell className="text-right">{p.waist != null ? fmt(p.waist, 1) : "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit weigh-in of ${fmtDate(p.date, "year")}`} onClick={() => setEditW({ date: p.date, weight: p.w, waist: p.waist })}><Pencil /></Button>
                      <ConfirmDelete label={`Delete weigh-in of ${fmtDate(p.date, "year")}`} onConfirm={() => { updateDay(p.date, (d) => { d.weight = null; d.waist = null }); toast("Weigh-in deleted") }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground">Your weigh-ins will be listed here. Log your first one above.</p>}
        </CardContent>
      </Card>
      <QuoteLine seed={today() + "scale"} mine={s.profile.myQuotes} />
    </div>
  )
}

function AdaptiveCard({ M, using }: { M: Metrics; using: boolean }) {
  const ad = M.ad
  const formulaBurn = M.tdee + M.credit * (ad.avgEx || 0)
  const setMode = (v: "formula" | "adaptive") => { patchProfile({ targetMode: v }); toast.success(v === "adaptive" ? "Adaptive target on" : "Formula target on") }
  const meter = (label: string, have: number, need: number) => (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-[13.5px]"><span>{label}</span><span className="tnum"><b>{Math.min(have, need)}</b> / {need}</span></div>
      <Progress value={(have / need) * 100} />
    </div>
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Adaptive metabolism</CardTitle>
        <CardDescription>Compares what you eat with how your trend weight moves, measures your real daily burn and adjusts your target to it.</CardDescription>
        <CardAction>{ad.ok ? <Badge variant={ad.quality === "Good" ? "good" : "warn"}>{ad.quality} data</Badge> : <Badge variant="accent">Learning</Badge>}</CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {ad.ok ? (
          <>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <StatTile label="Measured burn" value={fmt(ad.tdee)} sub="kcal / day" />
              <StatTile label="Formula says" value={fmt(formulaBurn)} sub={`${signed((ad.tdee as number) - formulaBurn, 0)} kcal difference`} />
              <StatTile label="Adaptive target" value={fmt(Math.max(M.floor, Math.round(((ad.tdee as number) - M.credit * (ad.avgEx || 0) + M.delta) / 10) * 10))} sub="kcal / day" />
            </div>
            <p className="text-sm text-muted-foreground">
              Over the last 4 weeks you ate {fmt(ad.avgIntake)} kcal a day on average and your weight moved {signed((ad.slope || 0) * 7, 2)} kg a week ({ad.foodDays} logged days, {ad.weighIns} weigh-ins).
            </p>
            {using ? (
              <div className="flex flex-wrap items-center gap-3"><Badge variant="good">Adaptive target in use</Badge><Button variant="outline" size="sm" onClick={() => setMode("formula")}>Switch back to formula</Button></div>
            ) : <Button onClick={() => setMode("adaptive")}>Use the adaptive target</Button>}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{ad.reason || "Keep logging. It unlocks with 10 fully logged days and 3 weigh-ins spread over at least 10 days, all within the last 4 weeks."}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {meter("Fully logged days", ad.foodDays, 10)}
              {meter("Weigh-ins", ad.weighIns, 3)}
              {meter("Days between weigh-ins", ad.span, 10)}
            </div>
            {!using && <div><Button variant="outline" size="sm" onClick={() => setMode("adaptive")}>Switch to adaptive when ready</Button></div>}
          </>
        )}
      </CardContent>
    </Card>
  )
}
