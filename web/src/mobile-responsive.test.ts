/// <reference types="node" />

import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(process.cwd(), "..")

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

describe("mobile responsive implementation", () => {
  it("uses dynamic viewport units and safe-area aware globals", () => {
    const css = read("web/src/styles/globals.css")
    const app = read("web/src/App.tsx")

    expect(css).toContain("overflow-x: hidden")
    expect(css).toContain("--safe-bottom")
    expect(css).toContain("touch-action: manipulation")
    expect(app).toContain("min-h-dvh")
    expect(app).toContain("pb-[calc")
  })

  it("adapts the main mobile controls instead of relying on desktop sizing", () => {
    const topbar = read("web/src/components/Topbar.tsx")
    const sidePanel = read("web/src/components/SidePanel.tsx")
    const composer = read("web/src/components/Composer.tsx")

    expect(topbar).toContain("max-[360px]")
    expect(sidePanel).toContain("safe-bottom")
    expect(sidePanel).toContain("max-h-[min(88dvh")
    expect(composer).toContain("min-h-[120px] sm:min-h-[200px]")
    expect(composer).toContain("grid-cols-1 gap-2 sm:grid-cols")
  })

  it("keeps result cards, history rows, and legacy Gradio usable on phones", () => {
    const resultCard = read("web/src/components/ResultCard.tsx")
    const historyItem = read("web/src/components/panels/HistoryItem.tsx")
    const legacyCss = read("qwen_tts/serve/ui_voices.py")

    expect(resultCard).toContain("max-[430px]:flex-col")
    expect(resultCard).toContain("min-w-0 break-words")
    expect(historyItem).toContain("opacity-100 sm:opacity-0")
    expect(historyItem).toContain("min-h-[44px]")
    expect(legacyCss).toContain("@media (max-width: 768px)")
    expect(legacyCss).toContain("grid-template-columns: 1fr")
  })
})
