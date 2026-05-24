const LANG_ZH: Record<string, string> = {
  Auto: "自动", auto: "自动",
  Chinese: "中文", chinese: "中文",
  English: "英语", english: "英语",
  Japanese: "日语", japanese: "日语",
  Korean: "韩语", korean: "韩语",
  German: "德语", german: "德语",
  French: "法语", french: "法语",
  Russian: "俄语", russian: "俄语",
  Portuguese: "葡语", portuguese: "葡语",
  Spanish: "西语", spanish: "西语",
  Italian: "意语", italian: "意语",
}

export function formatLanguage(lang: string | undefined): string {
  if (!lang) return "自动"
  return LANG_ZH[lang] ?? lang
}

export function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const minute = 60 * 1000, hour = 60 * minute, day = 24 * hour
  if (diff < minute) return "刚刚"
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  const d = new Date(ts)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`
}

export function formatGroupLabel(ts: number): string {
  const now = new Date()
  const d = new Date(ts)
  const sameDay = now.toDateString() === d.toDateString()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const isYesterday = yesterday.toDateString() === d.toDateString()
  if (sameDay) return "今天"
  if (isYesterday) return "昨天"
  return "更早"
}

export function truncate(text: string, n: number): string {
  return text.length <= n ? text : text.slice(0, n) + "…"
}
