import { useThemeSync } from "@/hooks/useThemeSync"
import { useVariant } from "@/hooks/useVariant"
import { StudioBoot, StudioError } from "@/components/StudioBoot"
import { CustomVoiceStudio } from "@/studios/CustomVoiceStudio"
import { VoiceDesignStudio } from "@/studios/VoiceDesignStudio"
import { CloneStudio } from "@/studios/CloneStudio"

export default function App() {
  useThemeSync()
  const { variant, status } = useVariant()

  if (status === "loading") return <StudioBoot />
  if (status === "error" || !variant) return <StudioError />

  switch (variant) {
    case "voicedesign":
      return <VoiceDesignStudio />
    case "base":
      return <CloneStudio />
    default:
      return <CustomVoiceStudio />
  }
}
