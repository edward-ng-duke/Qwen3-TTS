import { useThemeSync } from "@/hooks/useThemeSync"
import { useVariant } from "@/hooks/useVariant"
import { usePath } from "@/lib/router"
import { StudioBoot, StudioError } from "@/components/StudioBoot"
import { CustomVoiceStudio } from "@/studios/CustomVoiceStudio"
import { VoiceDesignStudio } from "@/studios/VoiceDesignStudio"
import { CloneStudio } from "@/studios/CloneStudio"
import { GalleryPage } from "@/pages/GalleryPage"
import { SharePage } from "@/pages/SharePage"

export default function App() {
  useThemeSync()
  const path = usePath()
  const { variant, status } = useVariant()

  // Public, variant-independent routes (no login, served as SPA shells).
  if (path === "/gallery" || path.startsWith("/gallery/")) return <GalleryPage />
  if (path.startsWith("/share/")) return <SharePage />

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
