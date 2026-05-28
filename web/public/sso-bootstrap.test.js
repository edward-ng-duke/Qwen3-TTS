import { beforeEach, describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const SCRIPT_PATH = path.resolve(process.cwd(), "public/sso-bootstrap.js")

function runBootstrapAt(url) {
  window.history.replaceState(null, "", url)
  const source = fs.readFileSync(SCRIPT_PATH, "utf8")
  Function(source)()
}

describe("Homepage SSO bootstrap", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.history.replaceState(null, "", "/")
  })

  it("stores access_token under the app auth token key and removes it from the URL", () => {
    runBootstrapAt("/#access_token=jwt-token")

    expect(localStorage.getItem("access_token")).toBe("jwt-token")
    expect(localStorage.getItem("auth_source")).toBe("local")
    expect(window.location.hash).toBe("")
  })

  it("overwrites stale token and clears stale user metadata", () => {
    localStorage.setItem("access_token", "old-token")
    localStorage.setItem("auth_source", "es")
    localStorage.setItem("auth_user", JSON.stringify({ username: "old" }))

    runBootstrapAt("/#access_token=fresh-token")

    expect(localStorage.getItem("access_token")).toBe("fresh-token")
    expect(localStorage.getItem("auth_source")).toBe("local")
    expect(localStorage.getItem("auth_user")).toBeNull()
  })

  it("preserves unrelated fragment parameters when stripping the token", () => {
    runBootstrapAt("/studio?x=1#tab=voices&access_token=abc%20123&mode=edit")

    expect(localStorage.getItem("access_token")).toBe("abc 123")
    expect(window.location.pathname).toBe("/studio")
    expect(window.location.search).toBe("?x=1")
    expect(window.location.hash).toBe("#tab=voices&mode=edit")
  })
})
