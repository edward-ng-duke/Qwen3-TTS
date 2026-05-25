import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useUiStore } from "@/stores/useUiStore"
import { T } from "@/lib/i18n"

interface RowProps {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  min: number; max: number; step: number
}

function Row({ label, hint, value, onChange, min, max, step }: RowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="tabular-nums text-[var(--text-primary)] font-medium">
          {value.toFixed(step < 1 ? 2 : 0)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min} max={max} step={step}
        onValueChange={([v]) => onChange(v)}
      />
      {hint && (
        <p className="text-[11px] text-[var(--text-tertiary)] leading-snug">{hint}</p>
      )}
    </div>
  )
}

export function Advanced() {
  const advanced = useUiStore((s) => s.advanced)
  const setAdvanced = useUiStore((s) => s.setAdvanced)
  const reset = useUiStore((s) => s.resetAdvanced)

  return (
    <div className="space-y-4">
      <Row label={T.sidePanel.advanced.temperature}
           hint={T.sidePanel.advanced.temperatureHint}
           value={advanced.temperature ?? 0.9}
           onChange={(v) => setAdvanced({ temperature: v })}
           min={0.1} max={1.5} step={0.05} />
      <Row label={T.sidePanel.advanced.topK}
           value={advanced.top_k ?? 50}
           onChange={(v) => setAdvanced({ top_k: Math.round(v) })}
           min={1} max={100} step={1} />
      <Row label={T.sidePanel.advanced.topP}
           hint={T.sidePanel.advanced.topPHint}
           value={advanced.top_p ?? 1.0}
           onChange={(v) => setAdvanced({ top_p: v })}
           min={0.1} max={1.0} step={0.05} />
      <Row label="重复惩罚"
           value={advanced.repetition_penalty ?? 1.05}
           onChange={(v) => setAdvanced({ repetition_penalty: v })}
           min={1.0} max={1.5} step={0.01} />
      <Row label="最大生成长度"
           value={advanced.max_new_tokens ?? 2048}
           onChange={(v) => setAdvanced({ max_new_tokens: Math.round(v) })}
           min={256} max={4096} step={128} />
      <div className="pt-3 border-t" style={{ borderColor: "var(--glass-thin-border)" }}>
        <h4 className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium mb-2">
          副音轨参数
        </h4>
        <div className="space-y-3">
          <Row label="副音轨 · 随机度"
               value={advanced.subtalker_temperature ?? 0.9}
               onChange={(v) => setAdvanced({ subtalker_temperature: v })}
               min={0.1} max={1.5} step={0.05} />
          <Row label="副音轨 · 候选数"
               value={advanced.subtalker_top_k ?? 50}
               onChange={(v) => setAdvanced({ subtalker_top_k: Math.round(v) })}
               min={1} max={100} step={1} />
          <Row label="副音轨 · 核采样阈值"
               value={advanced.subtalker_top_p ?? 1.0}
               onChange={(v) => setAdvanced({ subtalker_top_p: v })}
               min={0.1} max={1.0} step={0.05} />
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={reset} className="w-full">
        {T.sidePanel.advanced.reset}
      </Button>
    </div>
  )
}
