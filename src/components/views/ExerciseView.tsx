import { useState } from "react"
import { Flame, HeartPulse, Pencil, Trash2 } from "lucide-react"
import { WorkoutEditor } from "@/components/editors"
import type { ExEntry } from "@/lib/types"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Banners, DateNav, QuoteLine, StatTile, UnitInput, type ViewProps } from "@/components/shared"
import { BarsChart } from "@/components/charts"
import { blankDay, exKcal, exMin } from "@/lib/calc"
import { EXERCISES, EX_INDEX } from "@/lib/data"
import { addDays, fmtDate, today, weekStart } from "@/lib/dates"
import { updateDay } from "@/lib/store"
import { fmt, newId, num, parseNum, sum } from "@/lib/utils"

const ZONES: [string, string, number, number][] = [
  ["Zone 1", "Recovery", 0.5, 0.6], ["Zone 2", "Endurance, fat burning", 0.6, 0.7], ["Zone 3", "Aerobic", 0.7, 0.8],
  ["Zone 4", "Threshold", 0.8, 0.9], ["Zone 5", "Maximum", 0.9, 1],
]

export function ExerciseView({ s, M, date, setDate, go }: ViewProps) {
  const [act, setAct] = useState("walk")
  const [min, setMin] = useState("30")
  const [km, setKm] = useState("")
  const [kcalIn, setKcalIn] = useState("")
  const [name, setName] = useState("")
  const [editEx, setEditEx] = useState<{ date: string; entry: ExEntry } | null>(null)
  const goal = M.exGoal
  const day = s.days[date] ?? blankDay(date)
  const ws = weekStart(date)
  const week = Array.from({ length: 7 }, (_, i) => s.days[addDays(ws, i)] ?? blankDay(addDays(ws, i)))
  const wSessions = sum(week.map((d) => d.ex.length))
  const wMin = sum(week.map(exMin))
  const wKcal = sum(week.map(exKcal))
  const ws0 = weekStart(today())
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws0, (i - 7) * 7))
  const recent = Object.values(s.days).filter((d) => d.ex.length).sort((a, b) => (a.date < b.date ? 1 : -1)).flatMap((d) => d.ex.map((e) => ({ ...e, date: d.date }))).slice(0, 12)

  const m = parseNum(min)
  const manual = parseNum(kcalIn)
  const ex = EX_INDEX[act]
  const estimate = num(manual) ? manual : ex && num(m) ? (ex.met * M.w * m) / 60 : null

  const add = () => {
    if (!num(m) || m <= 0) { toast("Enter how many minutes you trained."); return }
    if (act === "other" && !num(manual)) { toast("Enter the calories for this workout."); return }
    const kcal = Math.round(estimate ?? 0)
    const nm = act === "other" ? name.trim() || "Workout" : ex.name
    const dist = parseNum(km)
    updateDay(date, (d) => { d.ex.push({ id: newId(), act, name: nm, met: ex ? ex.met : null, min: m, km: num(dist) ? dist : null, kcal, manual: num(manual) }) })
    setKcalIn(""); setKm(""); setName("")
    toast.success(`${nm} logged · ${fmt(kcal)} kcal. Every workout is a promise kept.`)
  }

  return (
    <div className="grid gap-5">
      <Banners s={s} go={go} />
      <DateNav date={date} setDate={setDate} />
      <WorkoutEditor target={editEx} weight={M.w} onClose={() => setEditEx(null)} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Log a workout</CardTitle><CardDescription>Calories come from MET values and your weight</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="exact">Activity</Label>
              <Select value={act} onValueChange={setAct}>
                <SelectTrigger id="exact"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXERCISES.map(([g, list]) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{g}</SelectLabel>
                      {list.map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}
                    </SelectGroup>
                  ))}
                  <SelectGroup><SelectLabel>Other</SelectLabel><SelectItem value="other">Other (enter calories)</SelectItem></SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {act === "other" && (
              <div className="grid gap-1.5"><Label htmlFor="exname">Name</Label><Input id="exname" maxLength={60} placeholder="e.g. Padel" value={name} onChange={(e) => setName(e.target.value)} /></div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5"><Label htmlFor="exmin">Duration</Label><UnitInput id="exmin" unit="min" step="1" value={min} onChange={(e) => setMin(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label htmlFor="exkm">Distance</Label><UnitInput id="exkm" unit="km" step="0.1" placeholder="—" value={km} onChange={(e) => setKm(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label htmlFor="exkcal">Calories</Label><UnitInput id="exkcal" unit="kcal" step="1" placeholder="auto" value={kcalIn} onChange={(e) => setKcalIn(e.target.value)} /></div>
            </div>
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              {estimate != null ? (
                <>
                  <Flame className="size-4 self-center text-primary" />
                  <b className="font-display text-xl font-semibold">≈ {fmt(estimate)} kcal</b>
                  <span className="text-muted-foreground">{num(manual) ? "your number" : `MET ${fmt(ex.met, 1)} × ${fmt(M.w, 1)} kg × ${fmt((m as number) / 60, 2)} h`}</span>
                </>
              ) : <span className="text-muted-foreground">{act === "other" ? "Enter the calories from your watch or app." : "Enter a duration to see the estimate."}</span>}
            </p>
            <Button onClick={add}>Add workout</Button>

            <div className="flex items-center justify-between border-t pt-4">
              <b>{date === today() ? "Today" : fmtDate(date, "day")}</b>
              <span className="text-sm text-muted-foreground tnum">{fmt(exMin(day))} min · {fmt(exKcal(day))} kcal</span>
            </div>
            <div className="grid">
              {day.ex.length ? day.ex.map((e) => (
                <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 border-b py-2 last:border-0">
                  <div className="grid min-w-0"><span className="truncate">{e.name}</span><small className="text-xs text-muted-foreground">{fmt(e.min)} min{e.km != null ? ` · ${fmt(e.km, 1)} km` : ""}{e.met != null ? ` · MET ${fmt(e.met, 1)}` : ""}</small></div>
                  <span className="text-sm tnum">{fmt(e.kcal)} kcal</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${e.name}`} onClick={() => setEditEx({ date, entry: e })}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${e.name}`} onClick={() => updateDay(date, (d) => { d.ex = d.ex.filter((x) => x.id !== e.id) })}><Trash2 /></Button>
                </div>
              )) : <p className="text-sm text-muted-foreground">Nothing logged for this day.</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              {M.credit ? `${Math.round(M.credit * 100)}% of workout calories are added to that day's food budget. MET estimates run high, so 50% is a safe default.` : "Workout calories are not added to your food budget."} Change it in Metabolism → Advanced settings.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Week of {fmtDate(ws)}</CardTitle>
            <CardAction><Badge variant={wMin >= goal ? "good" : "secondary"}>{wMin >= goal ? "Goal reached" : `${fmt(Math.max(0, goal - wMin))} min to go`}</Badge></CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-2.5">
              <StatTile label="Sessions" value={wSessions} />
              <StatTile label="Minutes" value={fmt(wMin)} />
              <StatTile label="Burned" value={fmt(wKcal)} sub="kcal" />
            </div>
            <Progress value={(wMin / goal) * 100} indicatorStyle={{ background: "var(--good)" }} />
            <p className="text-xs text-muted-foreground">Your goal: {fmt(goal)} min a week{goal === 150 ? " (WHO recommendation)" : ""}. The WHO recommends at least 150 minutes of moderate activity a week, plus strength training twice a week. <button className="cursor-pointer font-bold text-primary underline-offset-2 hover:underline" onClick={() => go("metab")}>Change goal</button></p>
            <b className="text-sm">Minutes per week</b>
            <BarsChart
              unit="min" refValue={goal} refLabel={`${fmt(goal)} min`} height={190}
              data={weeks.map((w) => {
                const v = sum(Array.from({ length: 7 }, (_, j) => { const d = s.days[addDays(w, j)]; return d ? exMin(d) : 0 }))
                return { label: fmtDate(w), v, tone: v <= 0 ? "mute" : v >= goal ? "good" : "acc" }
              })}
            />
            <div className="flex items-center gap-2 border-t pt-4"><HeartPulse className="size-5 text-primary" /><b>Heart-rate zones</b></div>
            <p className="text-xs text-muted-foreground">Max heart rate ≈ {M.maxHR} bpm (Tanaka: 208 − 0.7 × age {M.age}).</p>
            <Table>
              <TableHeader><TableRow><TableHead>Zone</TableHead><TableHead>Effort</TableHead><TableHead className="text-right">Heart rate</TableHead></TableRow></TableHeader>
              <TableBody>
                {ZONES.map(([z, n, a, b]) => (
                  <TableRow key={z}><TableCell>{z}</TableCell><TableCell>{n}</TableCell><TableCell className="text-right">{Math.round(M.maxHR * a)}–{Math.round(M.maxHR * b)} bpm</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent workouts</CardTitle></CardHeader>
        <CardContent>
          {recent.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Activity</TableHead><TableHead className="text-right">Time</TableHead><TableHead className="text-right">Distance</TableHead><TableHead className="text-right">kcal</TableHead><TableHead><span className="sr-only">Edit</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {recent.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{fmtDate(e.date, "day")}</TableCell><TableCell>{e.name}</TableCell>
                    <TableCell className="text-right">{fmt(e.min)} min</TableCell><TableCell className="text-right">{e.km != null ? `${fmt(e.km, 1)} km` : "—"}</TableCell>
                    <TableCell className="text-right">{fmt(e.kcal)}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon-sm" aria-label={`Edit ${e.name}`} onClick={() => { const { date: d, ...entry } = e; setEditEx({ date: d, entry }) }}><Pencil /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground">Your workouts will appear here once you log them.</p>}
        </CardContent>
      </Card>
      <QuoteLine seed={date + "move"} mine={s.profile.myQuotes} />
    </div>
  )
}
