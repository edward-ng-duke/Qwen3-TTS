import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useUiStore } from "@/stores/useUiStore"

interface RowProps {
  label: string
  value: number
  onChange: (v: number) => void
  min: number; max: number; step: number
}

function Row({ label, value, onChange, min, max, step }: RowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="tabular-nums">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <Slider
        value={[value]}
        min={min} max={max} step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  )
}

export function Advanced() {
  const advanced = useUiStore((s) => s.advanced)
  const setAdvanced = useUiStore((s) => s.setAdvanced)
  const reset = useUiStore((s) => s.resetAdvanced)

  return (
    <div className="space-y-4">
      <Row label="temperature" value={advanced.temperature ?? 0.9}
           onChange={(v) => setAdvanced({ temperature: v })}
           min={0.1} max={1.5} step={0.05} />
      <Row label="top_k" value={advanced.top_k ?? 50}
           onChange={(v) => setAdvanced({ top_k: Math.round(v) })}
           min={1} max={100} step={1} />
      <Row label="top_p" value={advanced.top_p ?? 1.0}
           onChange={(v) => setAdvanced({ top_p: v })}
           min={0.1} max={1.0} step={0.05} />
      <Row label="repetition_penalty" value={advanced.repetition_penalty ?? 1.05}
           onChange={(v) => setAdvanced({ repetition_penalty: v })}
           min={1.0} max={1.5} step={0.01} />
      <Row label="max_new_tokens" value={advanced.max_new_tokens ?? 2048}
           onChange={(v) => setAdvanced({ max_new_tokens: Math.round(v) })}
           min={256} max={4096} step={128} />
      <div className="pt-2 border-t border-border">
        <h4 className="text-xs text-text-muted mb-2">Sub-talker</h4>
        <div className="space-y-3">
          <Row label="subtalker_temperature" value={advanced.subtalker_temperature ?? 0.9}
               onChange={(v) => setAdvanced({ subtalker_temperature: v })}
               min={0.1} max={1.5} step={0.05} />
          <Row label="subtalker_top_k" value={advanced.subtalker_top_k ?? 50}
               onChange={(v) => setAdvanced({ subtalker_top_k: Math.round(v) })}
               min={1} max={100} step={1} />
          <Row label="subtalker_top_p" value={advanced.subtalker_top_p ?? 1.0}
               onChange={(v) => setAdvanced({ subtalker_top_p: v })}
               min={0.1} max={1.0} step={0.05} />
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={reset} className="w-full">
        恢复默认
      </Button>
    </div>
  )
}
