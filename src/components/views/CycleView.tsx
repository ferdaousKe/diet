import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Lock, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Banners, ConfirmDelete, Note, NumberField, StatTile, type ViewProps } from "@/components/shared"
import { cycleContext, dayInfo, PHASE_COLOR, PHASES, phaseName } from "@/lib/cycle"
import { addDays, daysBetween, fmtDate, iso, parseISO, today } from "@/lib/dates"
import { deleteAllCycleData, deleteCycle, patchProfile, saveCycle } from "@/lib/store"
import { cn, newId } from "@/lib/utils"

const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)

export function CycleView({ s, go }: ViewProps) {
  const t = today()
  const ctx = useMemo(() => cycleContext(s.cycles, s.profile, t), [s.cycles, s.profile, t])
  const { stats } = ctx
  const [start, setStart] = useState(t)
  const [end, setEnd] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [month, setMonth] = useState(t.slice(0, 7))
  const [wipe, setWipe] = useState(false)
  const open = [...ctx.periods].reverse().find((p) => !p.end && daysBetween(p.start, t) < 10)
  const info = dayInfo(ctx, t)
  const next = ctx.predicted.find((p) => p.start >= t) ?? ctx.predicted[0]
  const canWrite = s.conn === "cloud"

  const overlaps = (a: string, b: string, id: string | null) =>
    ctx.periods.some((p) => p.id !== id && a <= (p.end ?? p.start) && b >= p.start)
  const save = () => {
    if (!validDate(start) || start > t) { toast("Pick a start date up to today."); return }
    if (end && (!validDate(end) || end < start || end > t)) { toast("The end date must be between the start date and today."); return }
    if (end && daysBetween(start, end) > 14) { toast("A period longer than 15 days looks like a typo. Check the dates."); return }
    if (overlaps(start, end || start, editing)) { toast("These dates overlap another recorded period."); return }
    if (saveCycle({ id: editing ?? "p-" + newId(), start, end: end || null })) {
      toast.success(editing ? "Period updated" : "Period recorded")
      setEditing(null); setEnd(""); setStart(t)
    }
  }
  const quick = () => {
    if (open) { if (saveCycle({ ...open, end: t })) toast.success("Period end recorded for today") }
    else if (overlaps(t, t, null)) toast("Today is already inside a recorded period.")
    else if (saveCycle({ id: "p-" + newId(), start: t, end: null })) toast.success("Period start recorded for today")
  }

  return (
    <div className="grid gap-5">
      <Banners s={s} go={go} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Cycle Tracking</CardTitle>
              <CardDescription>Record your periods. Phases and future dates are estimates and are always marked as such.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {!canWrite && <Note tone="warn">Sign in with Google to record cycle data. It is never stored in this browser.</Note>}
              <Button disabled={!canWrite} onClick={quick}>{open ? "My period ended today" : "My period started today"}</Button>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid min-w-0 gap-1.5"><Label htmlFor="cy-start">Start date</Label><Input id="cy-start" type="date" max={t} value={start} onChange={(e) => setStart(e.target.value)} /></div>
                <div className="grid min-w-0 gap-1.5"><Label htmlFor="cy-end">End date</Label><Input id="cy-end" type="date" max={t} min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">Leave the end date empty while your period is ongoing.</p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={!canWrite} onClick={save}>{editing ? "Save changes" : "Record period"}</Button>
                {editing && <Button variant="ghost" onClick={() => { setEditing(null); setStart(t); setEnd("") }}>Cancel</Button>}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <StatTile label="Cycle day" value={info.cycleDay ?? "—"} sub={info.phase ? `${phaseName(info.phase)}${info.recorded ? " · recorded" : " · estimated"}` : "no estimate yet"} />
                <StatTile label="Next period" value={next ? fmtDate(next.start) : "—"} sub={next ? `predicted · ${next.start < t ? "expected already, not recorded yet" : `in ${daysBetween(t, next.start)} days`}` : "needs a cycle length"} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cycle settings</CardTitle><CardDescription>Optional. Without them, lengths come from your own records only.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <NumberField id="cy-len" label="Cycle length" unit="days" step="1" value={s.profile.cycleLength}
                  onCommit={(v) => patchProfile({ cycleLength: v != null && v >= 15 && v <= 60 ? Math.round(v) : null })}
                  hint={stats.cycleSource === "records" ? `Empty: ${stats.cycleLen} days, median of your ${stats.observed.length} recorded cycle${stats.observed.length === 1 ? "" : "s"}` : "Empty: estimated from 2+ recorded periods"} />
                <NumberField id="cy-plen" label="Period length" unit="days" step="1" value={s.profile.periodLength}
                  onCommit={(v) => patchProfile({ periodLength: v != null && v >= 1 && v <= 14 ? Math.round(v) : null })}
                  hint={stats.periodSource === "records" ? `Empty: ${stats.periodLen} days, from your records` : "Empty: from periods with an end date"} />
              </div>
              {!stats.cycleLen && <Note>No cycle length is assumed. Predictions and phases appear once you set a length or record two periods.</Note>}
              {stats.observed.length >= 3 && Math.max(...stats.observed) - Math.min(...stats.observed) > 7 && (
                <Note tone="warn">Your recorded cycles vary by more than a week ({Math.min(...stats.observed)}–{Math.max(...stats.observed)} days), so predictions are less reliable.</Note>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
            <CardAction className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(addDays(month + "-01", -1).slice(0, 7))}><ChevronLeft /></Button>
              <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => setMonth(addDays(month + "-01", 32).slice(0, 7))}><ChevronRight /></Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            <MonthGrid month={month} ctx={ctx} />
            <div className="grid gap-1.5 text-xs">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <span className="flex items-center gap-1.5"><i className="size-3.5 rounded-md bg-period" />Recorded period</span>
                <span className="flex items-center gap-1.5"><i className="size-3.5 rounded-md border-2 border-dashed border-period" />Predicted period</span>
                <span className="flex items-center gap-1.5"><i className="size-3.5 rounded-md ring-2 ring-foreground" />Today</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-muted-foreground">
                <span className="font-bold">Estimated phase:</span>
                {PHASES.filter(([k]) => k !== "menstrual").map(([k, l]) => (
                  <span key={k} className="flex items-center gap-1.5"><i className="h-1.5 w-4 rounded-full" style={{ background: PHASE_COLOR[k] }} />{l}</span>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Phases are estimated from your cycle length (ovulation about 14 days before the next period). They are not measured and can be off by several days.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recorded periods</CardTitle></CardHeader>
        <CardContent>
          {ctx.periods.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead className="text-right">Days</TableHead><TableHead className="text-right">Cycle length</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {[...ctx.periods].reverse().map((p) => {
                  const i = ctx.periods.indexOf(p)
                  const nx = ctx.periods[i + 1]
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{fmtDate(p.start, "year")}</TableCell>
                      <TableCell>{p.end ? fmtDate(p.end, "year") : daysBetween(p.start, t) < 10 ? <Badge variant="secondary">ongoing</Badge> : <span className="text-muted-foreground">not recorded</span>}</TableCell>
                      <TableCell className="text-right">{p.end ? daysBetween(p.start, p.end) + 1 : "—"}</TableCell>
                      <TableCell className="text-right">{nx ? `${daysBetween(p.start, nx.start)} d` : "current"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit period of ${fmtDate(p.start, "year")}`} onClick={() => { setEditing(p.id); setStart(p.start); setEnd(p.end ?? ""); window.scrollTo({ top: 0, behavior: "smooth" }) }}><Pencil /></Button>
                        <ConfirmDelete label={`Delete period of ${fmtDate(p.start, "year")}`} onConfirm={() => { deleteCycle(p.id); toast("Period deleted") }} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground">Nothing recorded yet. Your periods will be listed here.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="size-4" /> Privacy</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>Cycle records are saved only in your signed-in account's private space (<code>users/&lt;your id&gt;/cycles</code>). The database rules let only your Google account read or write them. They are never written to this browser's storage and are cleared from the screen when you sign out.</p>
          <div>
            {wipe ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-foreground">Delete every period record and your cycle settings?</span>
                <Button variant="outline" size="sm" className="border-bad text-bad" onClick={() => { deleteAllCycleData(); setWipe(false); toast("All cycle data deleted") }}>Delete all</Button>
                <Button variant="ghost" size="sm" onClick={() => setWipe(false)}>Cancel</Button>
              </div>
            ) : <Button variant="outline" size="sm" disabled={!canWrite || (!ctx.periods.length && s.profile.cycleLength == null && s.profile.periodLength == null)} onClick={() => setWipe(true)}>Delete all cycle data</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MonthGrid({ month, ctx }: { month: string; ctx: ReturnType<typeof cycleContext> }) {
  const first = parseISO(month + "-01")
  const lead = (first.getDay() + 6) % 7
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const t = today()
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(first.getFullYear(), first.getMonth(), i + 1)))]
  return (
    <div className="grid gap-2">
      <b className="font-display text-lg font-semibold">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const x = dayInfo(ctx, d)
          const label = [fmtDate(d, "day"), x.recorded ? "recorded period" : x.predictedPeriod ? "predicted period" : null,
            x.phase && !x.recorded && !x.predictedPeriod ? `estimated ${phaseName(x.phase).toLowerCase()} phase` : null,
            x.cycleDay ? `cycle day ${x.cycleDay}` : null].filter(Boolean).join(", ")
          return (
            <div
              key={d}
              title={label}
              aria-label={label}
              className={cn(
                "relative grid aspect-square place-items-center rounded-lg text-sm tnum",
                x.recorded ? "bg-period font-bold text-white" : x.predictedPeriod ? "border-2 border-dashed border-period font-bold text-period" : "bg-secondary/40",
                d === t && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
                d > t && !x.predictedPeriod && "text-muted-foreground",
              )}
            >
              {parseISO(d).getDate()}
              {x.phase && x.phase !== "menstrual" && !x.predictedPeriod && (
                <i className="absolute bottom-1 left-1/2 h-1 w-1/2 -translate-x-1/2 rounded-full" style={{ background: PHASE_COLOR[x.phase], opacity: 0.8 }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
