import { useEffect, useMemo, useState } from "react"
import { Activity, Apple, Flower2, Gauge, LogOut, Scale, Sun } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { TodayView } from "@/components/views/TodayView"
import { FoodView } from "@/components/views/FoodView"
import { ExerciseView } from "@/components/views/ExerciseView"
import { WeightView } from "@/components/views/WeightView"
import { MetabolismView } from "@/components/views/MetabolismView"
import type { ViewProps } from "@/components/shared"
import { metrics } from "@/lib/calc"
import { today } from "@/lib/dates"
import { connect, googleAuthEnabled, signInWithGoogle, signOutGoogle, useLedger } from "@/lib/store"
import type { Meal } from "@/lib/types"
import { cn } from "@/lib/utils"

const TABS = [
  ["today", "Today", Sun],
  ["food", "Food", Apple],
  ["exercise", "Exercise", Activity],
  ["weight", "Weight", Scale],
  ["metab", "Metabolism", Gauge],
] as const

function defaultMeal(): Meal {
  const h = new Date().getHours() + new Date().getMinutes() / 60
  return h < 10.5 ? "breakfast" : h < 15 ? "lunch" : h < 18 ? "snacks" : "dinner"
}
function initialTab() {
  const h = (typeof location !== "undefined" ? location.hash : "").slice(1)
  return TABS.some(([k]) => k === h) ? h : "today"
}

export default function App() {
  const s = useLedger()
  const [tab, setTab] = useState(initialTab)
  const [date, setDateState] = useState(today())
  const [meal, setMeal] = useState<Meal>(defaultMeal)
  useEffect(() => { void connect() }, [])

  const go = (t: string) => {
    setTab(t)
    try { history.replaceState(null, "", "#" + t) } catch { /* sandboxed frame */ }
    window.scrollTo({ top: 0 })
  }
  const setDate = (d: string) => setDateState(d > today() ? today() : d)
  const M = useMemo(() => metrics(s.profile, s.days, { profileSaved: s.profileSaved }), [s.profile, s.days, s.profileSaved])
  const props: ViewProps = { s, M, date, setDate, go, meal, setMeal }

  const status =
    s.conn === "device" ? { tone: "warn", text: "This browser" }
      : s.conn === "error" ? { tone: "bad", text: "Offline" }
        : s.conn === "connecting" || !s.loaded ? { tone: "warn", text: s.conn === "connecting" ? "Connecting…" : "Loading…" }
          : s.sync === "saving" ? { tone: "warn", text: "Saving…" }
            : s.sync === "error" ? { tone: "bad", text: "Not saved" }
              : { tone: "good", text: "Saved" }

  return (
    <Tabs value={tab} onValueChange={go}>
      <header className="sticky z-20 border-b bg-background/85 backdrop-blur-md" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft"><Flower2 className="size-5" /></span>
            <span className="font-display text-[22px] font-semibold tracking-tight whitespace-nowrap">Body <em className="text-primary">Ledger</em></span>
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-bold whitespace-nowrap text-muted-foreground">
              <i className={cn("size-2 rounded-full", status.tone === "good" ? "bg-good" : status.tone === "bad" ? "bg-bad" : "bg-warn")} />{status.text}
            </span>
            {s.me?.id && (
              <span className="flex min-w-0 items-center gap-2 font-bold">
                {s.me.avatarUrl && <img src={s.me.avatarUrl} alt="" className="size-8 shrink-0 rounded-full ring-2 ring-primary/30" />}
                <span className="hidden max-w-[16ch] truncate sm:inline">{s.me.name || "You"}</span>
              </span>
            )}
            {s.authProvider === "google" ? (
              <Button variant="ghost" size="icon-sm" onClick={() => void signOutGoogle()} aria-label="Sign out" title="Sign out">
                <LogOut />
              </Button>
            ) : googleAuthEnabled && !s.me?.id ? (
              <Button variant="outline" size="sm" onClick={() => void signInWithGoogle()}>
                <span aria-hidden="true" className="font-black text-blue-600">G</span>
                <span className="hidden sm:inline">Continue with Google</span>
                <span className="sm:hidden">Sign in</span>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-2.5 [scrollbar-width:none]">
          <TabsList>
            {TABS.map(([k, l, Icon]) => (
              <TabsTrigger key={k} value={k}><Icon /><span>{l}</span></TabsTrigger>
            ))}
          </TabsList>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-16">
        <TabsContent value="today"><TodayView {...props} /></TabsContent>
        <TabsContent value="food"><FoodView {...props} /></TabsContent>
        <TabsContent value="exercise"><ExerciseView {...props} /></TabsContent>
        <TabsContent value="weight"><WeightView {...props} /></TabsContent>
        <TabsContent value="metab"><MetabolismView {...props} /></TabsContent>
      </main>
      <Toaster />
    </Tabs>
  )
}
