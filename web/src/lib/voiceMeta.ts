export const VOICE_NAME_ZH: Record<string, string> = {
  vivian:   "薇薇安",
  ryan:     "莱恩",
  serena:   "思琳",
  uncle_fu: "福伯",
  aiden:    "艾登",
  ono_anna: "小野安娜",
  sohee:    "素熙",
  eric:     "艾里克",
  dylan:    "迪伦",
}

export const VOICE_DESC_ZH: Record<string, string> = {
  vivian:   "温暖成熟的普通话女声，吐字清晰",
  ryan:     "自信的美式英语男声",
  serena:   "明亮的青年女声，带英式语调",
  uncle_fu: "沙哑年长的普通话男声，带讲故事的节奏",
  aiden:    "充满活力的美式青年男声",
  ono_anna: "干净利落的标准日语女声",
  sohee:    "温柔的青年韩语女声",
  eric:     "沉稳的标准德语男声",
  dylan:    "醇厚的英式男声，适合播客",
}

export function voiceName(v: { id: string; display_name: string }): string {
  return VOICE_NAME_ZH[v.id] ?? v.display_name
}

export function voiceNameById(id: string): string {
  return VOICE_NAME_ZH[id] ?? id
}

export function voiceDescription(v: { id: string; description: string }): string {
  return VOICE_DESC_ZH[v.id] ?? v.description
}
