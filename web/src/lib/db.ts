import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import type { SamplingParams } from "./api"

/** 历史记录由哪套 Studio 产生。缺省（老记录）视为 "customvoice"。 */
export type HistoryKind = "customvoice" | "design" | "clone"

export interface HistoryItem {
  id?: number
  createdAt: number
  kind?: HistoryKind
  text: string
  language: string
  // customvoice 专属（其它 kind 可缺省）
  speakerId?: string
  emotion?: string
  customInstruct?: string
  // design / clone 专属
  instruct?: string          // design：音色设计描述
  refText?: string           // clone：参考音频文字稿
  xVectorOnly?: boolean       // clone：是否仅用说话人向量
  cloneMode?: "instant" | "saved" // clone：一步式 or 复用 .pt
  label?: string             // 通用短标签（如样例说话人名 / "声音设计"）
  sampling?: SamplingParams
  seed?: number | null
  audioBlob: Blob
  audioMime: string
  audioDurationSec: number
  generationMs: number
}

interface Schema extends DBSchema {
  history: {
    key: number
    value: HistoryItem
    indexes: { createdAt: number }
  }
}

const DB_NAME = "qwen-tts"
// v2: HistoryItem 增加可选的 kind/instruct/refText 等字段（design/clone）。
// 全部为可选字段、不动索引，因此 upgrade 对老 customvoice 记录是无操作。
const DB_VERSION = 2
const MAX_ITEMS = 100
export const HISTORY_CHANGED_EVENT = "qwen-tts-history-changed"

export function notifyHistoryChanged(): void {
  window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT))
}

let _db: Promise<IDBPDatabase<Schema>> | null = null
function getDb() {
  if (!_db) {
    _db = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v0 → 全新建库；v1 → v2 仅新增可选字段，无需迁移数据。
        if (oldVersion < 1) {
          const store = db.createObjectStore("history", {
            keyPath: "id",
            autoIncrement: true,
          })
          store.createIndex("createdAt", "createdAt")
        }
      },
    })
  }
  return _db
}

export const historyDb = {
  async add(item: Omit<HistoryItem, "id">): Promise<number> {
    const db = await getDb()
    const id = await db.add("history", item as HistoryItem)
    await pruneOldest()
    return id as number
  },

  async listRecent(limit = 50): Promise<HistoryItem[]> {
    const db = await getDb()
    const tx = db.transaction("history")
    const idx = tx.store.index("createdAt")
    const items: HistoryItem[] = []
    for await (const cursor of idx.iterate(null, "prev")) {
      items.push(cursor.value)
      if (items.length >= limit) break
    }
    return items
  },

  async delete(id: number): Promise<void> {
    const db = await getDb()
    await db.delete("history", id)
  },

  async clear(): Promise<void> {
    const db = await getDb()
    await db.clear("history")
  },
}

async function pruneOldest() {
  const db = await getDb()
  const count = await db.count("history")
  if (count <= MAX_ITEMS) return
  const toDelete = count - MAX_ITEMS
  const tx = db.transaction("history", "readwrite")
  const idx = tx.store.index("createdAt")
  let n = 0
  for await (const cursor of idx.iterate(null, "next")) {
    await cursor.delete()
    if (++n >= toDelete) break
  }
  await tx.done
}
