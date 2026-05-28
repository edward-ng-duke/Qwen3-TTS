import { beforeEach, describe, expect, it } from "vitest"
import {
  AUTH_SOURCE_KEY,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  clearAuthSession,
  getAuthToken,
  setAuthToken,
  setAuthUser,
} from "./authStorage"

describe("authStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("stores and reads the access token from localStorage", () => {
    setAuthToken("jwt-token")

    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe("jwt-token")
    expect(getAuthToken()).toBe("jwt-token")
  })

  it("stores auth user and marks local auth source", () => {
    setAuthUser({
      id: "u1",
      username: "alice",
      display_name: "Alice",
      role: "user",
      status: "active",
      auth_source: "local",
    })

    expect(JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "{}")).toMatchObject({
      id: "u1",
      username: "alice",
    })
    expect(localStorage.getItem(AUTH_SOURCE_KEY)).toBe("local")
  })

  it("clears token, stale user, and auth source on logout", () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "old-token")
    localStorage.setItem(AUTH_USER_KEY, "{}")
    localStorage.setItem(AUTH_SOURCE_KEY, "local")

    clearAuthSession()

    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull()
    expect(localStorage.getItem(AUTH_SOURCE_KEY)).toBeNull()
  })
})
