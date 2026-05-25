import { createContext, useContext } from "react"
import type { AuthUser } from "@/lib/api"

export interface AuthContextValue {
  enabled: boolean
  user: AuthUser | null
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  enabled: false,
  user: null,
  logout: async () => undefined,
})

export const useAuth = () => useContext(AuthContext)
