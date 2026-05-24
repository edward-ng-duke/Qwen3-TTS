import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import type { SamplingParams } from "./api"

export interface HistoryItem {
  id?: number
  createdAt: number
  text: string
  language: string
  speakerId: string
  emotion: string
  customInstruct?: string
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
const DB_VERSION = 1
const MAX_ITEMS = 100
export const HISTORY_CHANGED_EVENT = "qwen-tts-history-changed"

export function notifyHistoryChanged(): void {
  window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT))
}

let _db: Promise<IDBPDatabase<Schema>> | null = null
function getDb() {
  if (!_db) {
    _db = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("history", {
          keyPath: "id",
          autoIncrement: true,
        })
        store.createIndex("createdAt", "createdAt")
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
