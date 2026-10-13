import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, parseNum } from "@/lib/utils"

export function NumberField({
  id, label, unit, value, onChange, onCommit, step = "any", placeholder, hint, className,
}: {
  id: string; label: string; unit?: string; value: number | null | undefined
  onChange?: (v: number | null) => void; onCommit?: (v: number | null) => void
  step?: string; placeholder?: string; hint?: ReactNode; className?: string
}) {
  const [text, setText] = useState(value == null ? "" : String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : String(value))
  }, [value])
  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={0}
          value={text}
          placeholder={placeholder}
          className={unit ? "pr-12" : undefined}
          onFocus={() => { focused.current = true }}
          onChange={(e) => { setText(e.target.value); onChange?.(parseNum(e.target.value)) }}
          onBlur={(e) => { focused.current = false; onCommit?.(parseNum(e.target.value)) }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
        />
        {unit && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold text-muted-foreground">{unit}</span>}
      </div>
      {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function UnitInput({ id, unit, className, ...props }: ComponentProps<typeof Input> & { unit: string }) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Input id={id} type="number" inputMode="decimal" min={0} className="pr-12" {...props} />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold text-muted-foreground">{unit}</span>
    </div>
  )
}

export function SelectField({
  id, label, value, options, onChange, hint,
}: {
  id: string; label: string; value: string; options: [string, string][]; onChange: (v: string) => void; hint?: ReactNode
}) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Field({ id, label, children, className }: { id?: string; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
