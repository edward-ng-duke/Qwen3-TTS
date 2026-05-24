import { cn } from "@/lib/utils"

interface SoundWaveProps {
  className?: string
  bars?: number
  color?: string  // CSS color or var
}

export function SoundWave({ className, bars = 5, color = "currentColor" }: SoundWaveProps) {
  return (
    <div className={cn("inline-flex items-end gap-[3px] h-4", className)} aria-label="生成中">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="block w-[3px] rounded-sm"
          style={{
            backgroundColor: color,
            animation: `sw-bar 900ms ease-in-out ${i * 90}ms infinite`,
            height: "30%",
          }}
        />
      ))}
      <style>{`@keyframes sw-bar { 0%,100% { height: 30% } 50% { height: 100% } }`}</style>
    </div>
  )
}
