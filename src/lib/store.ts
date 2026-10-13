/* Data store.
 * Inside claude.ai the app uses the artifact `db` capability: each signed-in person gets a private
 * subtree at data/users/<id>/profile (+ /days/<date>, /foods/<id>).
 * Elsewhere it uses Firebase when configured, then falls back to this browser's localStorage.
 */
import { useSyncExternalStore } from "react"
import type { Day, Food, Profile } from "./types"
import { DEFAULT_PROFILE } from "./data"
import { blankDay, isEmptyDay } from "./calc"
import { clone, num, round1, stable } from "./utils"
import { toast } from "sonner"
import { getApps, initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth"
import { collection, deleteDoc, doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore"

export type Conn = "connecting" | "cloud" | "device" | "error"
export interface Me { id: string | null; name: string; avatarUrl: string }
export interface LedgerState {
  profile: Profile
  profileSaved: boolean
  days: Record<string, Day>
  foods: Record<string, Food>
  conn: Conn
  sync: "idle" | "saving" | "error"
  me: Me | null
  authProvider: "google" | null
  loaded: boolean
}

let S: LedgerState = {
  profile: { ...DEFAULT_PROFILE }, profileSaved: false, days: {}, foods: {},
  conn: "connecting", sync: "idle", me: null, authProvider: null, loaded: false,
}
const subs = new Set<() => void>()
function set(patch: Partial<LedgerState>) {
  S = { ...S, ...patch }
  subs.forEach((f) => f())
}
export const getState = () => S
export function useLedger() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb) } },
    () => S,
  )
}

/* ---------- normalisers ---------- */
const PROFILE_KEYS = Object.keys(DEFAULT_PROFILE) as (keyof Profile)[]
function normProfile(d: Record<string, unknown>): Profile {
  const p = { ...DEFAULT_PROFILE } as Record<string, unknown>
  for (const k of PROFILE_KEYS) if (d[k] !== undefined) p[k] = d[k]
  return p as unknown as Profile
}
function normDay(d: Record<string, unknown>, id: string): Day {
  return {
    date: id,
    food: Array.isArray(d.food) ? (d.food as Day["food"]) : [],
    ex: Array.isArray(d.ex) ? (d.ex as Day["ex"]) : [],
    water: num(d.water) ? d.water : 0,
    weight: num(d.weight) ? d.weight : null,
    waist: num(d.waist) ? d.waist : null,
  }
}

/* ---------- cloud writes (one write at a time per document) ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ref = any
let base: Ref = null
let syncError = false
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const googleAuthEnabled = Object.values(firebaseConfig).every(Boolean)
const firebaseApp = googleAuthEnabled
  ? getApps()[0] || initializeApp(firebaseConfig)
  : null
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null
const firebaseDb = firebaseApp ? getFirestore(firebaseApp) : null
const cloudUnsubscribers: (() => void)[] = []
let activeUid: string | null = null

function firebaseDoc(reference: ReturnType<typeof doc>): Ref {
  return {
    path: reference.path,
    set: (data: unknown) => setDoc(reference, data as Record<string, unknown>),
    delete: () => deleteDoc(reference),
    collection: (name: string) => firebaseCollection(collection(reference, name)),
    onSnapshot: (next: (snap: Ref) => void, error: (e: { code?: string }) => void) =>
      onSnapshot(reference, (snap) => next({ exists: snap.exists(), data: () => snap.data() }), error),
  }
}
function firebaseCollection(reference: ReturnType<typeof collection>): Ref {
  return {
    path: reference.path,
    doc: (id: string) => firebaseDoc(doc(reference, id)),
    onSnapshot: (next: (snap: Ref) => void, error: (e: { code?: string }) => void) => onSnapshot(reference, next, error),
  }
}

export async function signInWithGoogle() {
  if (!firebaseAuth) return
  try {
    await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
  } catch (error) {
    if ((error as { code?: string })?.code !== "auth/popup-closed-by-user") {
      toast.error("Google sign-in failed. Check your Firebase configuration and try again.")
    }
  }
}
export async function signOutGoogle() {
  if (!firebaseAuth) return
  try {
    await signOut(firebaseAuth)
  } catch {
    toast.error("Could not sign out. Please try again.")
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const saver = {
  pending: new Map<string, { ref: Ref; data: unknown }>(),
  inflight: new Set<string>(),
  busy(path: string) { return this.pending.has(path) || this.inflight.has(path) },
  queue(ref: Ref, data: unknown) { this.pending.set(ref.path, { ref, data }); setSync(); void this.run(ref.path) },
  async run(path: string) {
    if (this.inflight.has(path)) return
    const job = this.pending.get(path)
    if (!job) return
    this.pending.delete(path)
    this.inflight.add(path)
    setSync()
    try {
      await doWrite(job)
      syncError = false
    } catch (e) {
      if ((e as { code?: string })?.code === "unavailable") {
        await sleep(400 + Math.random() * 800)
        try { await doWrite(job); syncError = false } catch (e2) { writeFailed(e2) }
      } else writeFailed(e)
    } finally {
      this.inflight.delete(path)
      if (this.pending.has(path)) void this.run(path)
      else setSync()
    }
  },
}
function doWrite(job: { ref: Ref; data: unknown }) {
  return job.data === null ? job.ref.delete() : job.ref.set(job.data)
}
function writeFailed(e: unknown) {
  syncError = true
  const code = (e as { code?: string })?.code
  if (code === "quota_exceeded") toast.error("Storage is full. Delete old entries to save new ones.")
  else if (code === "invalid_argument" || code === "not_granted" || code === "revoked") toast.error("This change could not be saved. Your access may be read-only.")
  else toast.error("Could not save. Check your connection and try again.")
}
function setSync() {
  set({ sync: saver.pending.size || saver.inflight.size ? "saving" : syncError ? "error" : "idle" })
}

/* ---------- device storage ---------- */
const LS_KEY = "body-ledger:v1"
let deviceTimer: ReturnType<typeof setTimeout> | undefined
function saveDevice() {
  clearTimeout(deviceTimer)
  deviceTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ profile: S.profile, profileSaved: S.profileSaved, days: S.days, foods: S.foods }))
    } catch {
      /* storage blocked: data stays for this visit */
    }
  }, 250)
}
function loadDevice() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    const d = JSON.parse(raw)
    const days: Record<string, Day> = {}
    for (const [id, v] of Object.entries(d.days || {})) days[id] = normDay(v as Record<string, unknown>, id)
    set({ profile: normProfile(d.profile || {}), profileSaved: !!d.profileSaved, days, foods: d.foods || {} })
  } catch {
    /* nothing stored or storage blocked */
  }
}

/* ---------- actions ---------- */
function persistDay(date: string, d: Day | null) {
  if (S.conn === "cloud") saver.queue(base.collection("days").doc(date), d ? clone(d) : null)
  else if (S.conn === "device") saveDevice()
}
function persistProfile() {
  if (!S.profileSaved) return
  if (S.conn === "cloud") saver.queue(base, clone(S.profile))
  else if (S.conn === "device") saveDevice()
}

export function updateDay(date: string, fn: (d: Day) => void) {
  const d = S.days[date] ? clone(S.days[date]) : blankDay(date)
  fn(d)
  const days = { ...S.days }
  const empty = isEmptyDay(d)
  if (empty) delete days[date]
  else days[date] = d
  set({ days })
  persistDay(date, empty ? null : d)
}
export function setWeight(date: string, kg: number, waist?: number | null) {
  updateDay(date, (d) => {
    d.weight = round1(kg)
    if (waist !== undefined) d.waist = waist
  })
}
export function patchProfile(patch: Partial<Profile>, persist = true) {
  set({ profile: { ...S.profile, ...patch } })
  if (persist) persistProfile()
}
export function saveProfileFirst() {
  set({ profileSaved: true })
  persistProfile()
}
export function saveFood(f: Food) {
  set({ foods: { ...S.foods, [f.id]: f } })
  if (S.conn === "cloud") saver.queue(base.collection("foods").doc(f.id), clone(f))
  else if (S.conn === "device") saveDevice()
}
export function deleteFood(id: string) {
  const foods = { ...S.foods }
  delete foods[id]
  set({ foods })
  if (S.conn === "cloud") saver.queue(base.collection("foods").doc(id), null)
  else if (S.conn === "device") saveDevice()
}

/* ---------- connection ---------- */
const loadedFlags = { profile: false, days: false, foods: false }
function refreshLoaded() {
  if (!S.loaded && loadedFlags.profile && loadedFlags.days && loadedFlags.foods) set({ loaded: true })
}
function onSubErr(e: { code?: string }) {
  if (S.conn !== "cloud") return
  set({ conn: "error" })
  toast.error(e?.code === "revoked" ? "Access to your saved data was withdrawn." : "Lost the connection to your saved data. Reload to reconnect.")
}

let started = false
function clearSessionData(conn: Conn, me: Me | null, authProvider: "google" | null) {
  loadedFlags.profile = false
  loadedFlags.days = false
  loadedFlags.foods = false
  set({
    profile: { ...DEFAULT_PROFILE }, profileSaved: false, days: {}, foods: {},
    conn, sync: "idle", me, authProvider, loaded: false,
  })
}

function useDeviceSession(me: Me | null = null) {
  cloudUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe())
  activeUid = null
  base = null
  loadDevice()
  set({ conn: "device", me, authProvider: null, loaded: true })
}

function attachCloud(userBase: Ref, me: Me, authProvider: "google" | null) {
  if (activeUid === me.id) return
  cloudUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe())
  activeUid = me.id
  base = userBase
  clearSessionData("cloud", me, authProvider)
  const currentBase = base
  const daysPath = currentBase.path + "/days"
  const foodsPath = currentBase.path + "/foods"

  cloudUnsubscribers.push(currentBase.onSnapshot((snap: Ref) => {
    if (activeUid !== me.id) return
    loadedFlags.profile = true
    if (!saver.busy(currentBase.path) && snap.exists) {
      const next = normProfile(snap.data() || {})
      if (!S.profileSaved || stable(next) !== stable(S.profile)) set({ profile: next, profileSaved: true })
    }
    refreshLoaded()
  }, onSubErr))

  cloudUnsubscribers.push(currentBase.collection("days").onSnapshot((snap: Ref) => {
    if (activeUid !== me.id) return
    let days = S.days
    let changed = false
    for (const ch of snap.docChanges()) {
      const id = ch.doc.id as string
      if (saver.busy(daysPath + "/" + id)) continue
      if (ch.type === "removed") {
        if (days[id]) { if (!changed) days = { ...days }; delete days[id]; changed = true }
        continue
      }
      const next = normDay(ch.doc.data() || {}, id)
      if (!days[id] || stable(next) !== stable(days[id])) {
        if (!changed) days = { ...days }
        days[id] = clone(next)
        changed = true
      }
    }
    loadedFlags.days = true
    if (changed) set({ days })
    refreshLoaded()
  }, onSubErr))

  cloudUnsubscribers.push(currentBase.collection("foods").onSnapshot((snap: Ref) => {
    if (activeUid !== me.id) return
    let foods = S.foods
    let changed = false
    for (const ch of snap.docChanges()) {
      const id = ch.doc.id as string
      if (saver.busy(foodsPath + "/" + id)) continue
      if (ch.type === "removed") {
        if (foods[id]) { if (!changed) foods = { ...foods }; delete foods[id]; changed = true }
        continue
      }
      const next = { ...(ch.doc.data() || {}), id } as Food
      if (!foods[id] || stable(next) !== stable(foods[id])) {
        if (!changed) foods = { ...foods }
        foods[id] = clone(next)
        changed = true
      }
    }
    loadedFlags.foods = true
    if (changed) set({ foods })
    refreshLoaded()
  }, onSubErr))
}

export async function connect() {
  if (started) return
  started = true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (window as any).claude
  const use = (n: string) =>
    c && typeof c.use === "function" ? Promise.resolve(c.use(n)).catch(() => null) : Promise.resolve(null)
  const [db, user] = await Promise.all([use("db"), use("user")])
  let me: Me | null = null
  if (user) {
    try { me = await user.me() } catch { me = null }
  }
  if (db && me?.id) {
    try {
      attachCloud(db.doc(`data/users/${me.id}/profile`), me, null)
    } catch {
      useDeviceSession(me)
    }
    return
  }
  if (firebaseAuth && firebaseDb) {
    onAuthStateChanged(firebaseAuth, (firebaseUser: User | null) => {
      if (!firebaseUser) {
        if (S.conn !== "device" || !S.loaded || activeUid) useDeviceSession()
        return
      }
      const googleMe = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email || "Google user",
        avatarUrl: firebaseUser.photoURL || "",
      }
      attachCloud(firebaseDoc(doc(firebaseDb, "users", firebaseUser.uid)), googleMe, "google")
    }, () => {
      toast.error("Could not verify your Google session.")
      useDeviceSession()
    })
    return
  }
  useDeviceSession(me)
}
