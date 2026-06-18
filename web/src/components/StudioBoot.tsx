import { type ReactNode } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { AuroraBackground } from "@/components/AuroraBackground"
import { GlassCard } from "@/components/GlassCard"
import { T } from "@/lib/i18n"

function Shell({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="min-h-dvh grid place-items-center px-4 text-[var(--text-primary)]">
      <AuroraBackground />
      <GlassCard
        variant="strong"
        className="relative z-10 max-w-full px-5 py-4 rounded-[var(--radius-island)] flex items-center gap-3"
      >
        {icon}
        <div className="min-w-0">
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
          {hint ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">{hint}</p>
          ) : null}
        </div>
      </GlassCard>
    </div>
  )
}

export function StudioBoot() {
  return (
    <Shell
      icon={<Loader2 className="size-4 shrink-0 animate-spin text-[var(--brand)]" />}
      title={T.boot.connecting}
    />
  )
}

export function StudioError() {
  return (
    <Shell
      icon={<AlertCircle className="size-4 shrink-0 text-[var(--danger)]" />}
      title={T.boot.errorTitle}
      hint={T.boot.errorHint}
    />
  )
}
