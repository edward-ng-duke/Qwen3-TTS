import type { AuthUser } from "@/lib/api"

export const AUTH_TOKEN_KEY = "access_token"
export const AUTH_USER_KEY = "auth_user"
export const AUTH_SOURCE_KEY = "auth_source"

export function getAuthToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || ""
  } catch {
    return ""
  }
}

export function setAuthToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token)
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY)
    }
  } catch {
    // Storage can be unavailable in hardened browser modes.
  }
}

export function setAuthUser(user: AuthUser): void {
  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    localStorage.setItem(AUTH_SOURCE_KEY, user.auth_source || "local")
  } catch {
    // Non-fatal; the server remains the source of truth.
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(AUTH_SOURCE_KEY)
  } catch {
    // Non-fatal.
  }
}
