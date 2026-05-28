import { beforeEach, describe, expect, it, vi } from "vitest"
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from "./authStorage"
import { api } from "./api"

describe("api auth integration", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("sends stored access token as Bearer auth and caches /api/auth/me user", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "jwt-token")
    const user = {
      id: "u1",
      username: "alice",
      display_name: "Alice",
      role: "user",
      status: "active",
      auth_source: "local",
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(api.me()).resolves.toEqual(user)

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ credentials: "include" }),
    )
    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer jwt-token")
    expect(JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "{}")).toEqual(user)
  })
})
