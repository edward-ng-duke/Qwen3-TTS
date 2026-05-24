import { useCallback, useEffect, useState } from "react"
import {
  HISTORY_CHANGED_EVENT,
  historyDb,
  notifyHistoryChanged,
  type HistoryItem,
} from "@/lib/db"

export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const refresh = useCallback(async () => {
    setItems(await historyDb.listRecent(100))
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      const next = await historyDb.listRecent(100)
      if (active) setItems(next)
    }
    void load()
    window.addEventListener(HISTORY_CHANGED_EVENT, load)
    return () => {
      active = false
      window.removeEventListener(HISTORY_CHANGED_EVENT, load)
    }
  }, [])

  const remove = useCallback(async (id: number) => {
    await historyDb.delete(id)
    notifyHistoryChanged()
  }, [])
  const clear = useCallback(async () => {
    await historyDb.clear()
    notifyHistoryChanged()
  }, [])
  return { items, refresh, remove, clear }
}
