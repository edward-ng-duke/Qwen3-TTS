import { useCallback, useEffect, useState } from "react"
import { historyDb, type HistoryItem } from "@/lib/db"

export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const refresh = useCallback(async () => {
    setItems(await historyDb.listRecent(100))
  }, [])
  useEffect(() => { refresh() }, [refresh])
  const remove = useCallback(async (id: number) => {
    await historyDb.delete(id); await refresh()
  }, [refresh])
  const clear = useCallback(async () => {
    await historyDb.clear(); await refresh()
  }, [refresh])
  return { items, refresh, remove, clear }
}
