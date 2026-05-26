import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Loader2, LogIn, ShieldCheck } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { AuroraBackground } from "@/components/AuroraBackground"
import { GlassCard } from "@/components/GlassCard"
import { api, ApiError, type AuthUser } from "@/lib/api"
import { AuthContext } from "@/lib/authContext"

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) {
    return "/"
  }
  return value
}

function isAuthDisabled(error: unknown): boolean {
  const authRequired = import.meta.env.VITE_AUTH_REQUIRED === "true"
  return error instanceof ApiError && error.status === 404 && !authRequired
}

function authBackendMissingMessage(error: unknown): string {
  if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
    return "当前 4967 后端还没有认证接口；可以预览登录页，真实登录需要启动带认证的新后端。"
  }
  return ""
}

function AuthLoading() {
  return (
    <div className="h-screen grid place-items-center text-[var(--text-primary)]">
      <AuroraBackground />
      <GlassCard variant="strong" className="relative z-10 px-5 py-4 rounded-[var(--radius-island)] flex items-center gap-3">
        <Loader2 className="size-4 animate-spin text-[var(--brand)]" />
        <span className="text-sm text-[var(--text-secondary)]">正在确认身份</span>
      </GlassCard>
    </div>
  )
}

function LoginPage({
  onAuthenticated,
  initialMessage,
}: {
  onAuthenticated: (user: AuthUser) => void
  initialMessage?: string
}) {
  const params = new URLSearchParams(window.location.search)
  const next = safeNext(params.get("next"))
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(initialMessage ?? "")

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setMessage("")
    try {
      const result = await api.login(username.trim(), password, rememberMe)
      // Update URL first so isLoginRoute recomputes to false on the next render.
      if (window.location.pathname !== next) {
        window.history.replaceState(null, "", next)
      }
      onAuthenticated(result.user)
    } catch (error) {
      const detail = error instanceof ApiError ? error.detail : ""
      setMessage(authBackendMissingMessage(error) || detail || "登录失败，请检查账号和密码")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 text-[var(--text-primary)]">
      <AuroraBackground />
      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-[min(430px,100%)]"
      >
        <GlassCard variant="strong" className="rounded-[var(--radius-island)] p-6 md:p-7">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: "var(--brand-gradient)", boxShadow: "0 8px 22px var(--brand-glow)" }}
            >
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">微趣登录</h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                使用现有账号继续访问工作台。
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">用户名</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                className="w-full rounded-[var(--radius-input)] px-3.5 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                style={{
                  background: "var(--input-well-bg)",
                  border: "1px solid var(--input-well-border)",
                  boxShadow: "var(--input-well-shadow)",
                }}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">密码</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-[var(--radius-input)] px-3.5 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                style={{
                  background: "var(--input-well-bg)",
                  border: "1px solid var(--input-well-border)",
                  boxShadow: "var(--input-well-shadow)",
                }}
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="size-4 rounded border-[var(--input-well-border)] accent-[var(--brand)]"
              />
              保持登录状态
            </label>

            {message ? (
              <p className="rounded-[var(--radius-chip)] border border-[oklch(0.65_0.22_25_/_0.25)] bg-[oklch(0.65_0.22_25_/_0.08)] px-3 py-2 text-sm text-[var(--danger)]">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-input)] text-sm font-semibold text-white transition-transform active:translate-y-px disabled:opacity-60"
              style={{ background: "var(--brand-gradient)", boxShadow: "0 10px 24px var(--brand-glow)" }}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              登录
            </button>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loginMessage, setLoginMessage] = useState("")
  const isLoginRoute = window.location.pathname === "/login"

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const current = await api.me()
        if (cancelled) return
        setUser(current)
        setEnabled(true)
        if (isLoginRoute) {
          const next = safeNext(new URLSearchParams(window.location.search).get("next"))
          window.location.replace(next)
        }
      } catch (meError) {
        if (isAuthDisabled(meError)) {
          if (!cancelled) {
            setEnabled(false)
            setChecking(false)
          }
          return
        }
        try {
          const exchanged = await api.verifyEsToken()
          if (cancelled) return
          setUser(exchanged.user)
          setEnabled(true)
          if (isLoginRoute) {
            const next = safeNext(new URLSearchParams(window.location.search).get("next"))
            window.location.replace(next)
          }
        } catch (exchangeError) {
          if (isAuthDisabled(exchangeError)) {
            if (!cancelled) {
              setEnabled(false)
              setChecking(false)
            }
            return
          }
          if (!cancelled) {
            setUser(null)
            setEnabled(true)
            setLoginMessage(authBackendMissingMessage(exchangeError)
              || (exchangeError instanceof ApiError && exchangeError.status === 503
                ? "认证服务暂不可用"
                : ""))
          }
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    return () => { cancelled = true }
    // Run only on mount. After login, AuthGate state is updated in-place via
    // onAuthenticated + history.replaceState — re-firing this effect on URL
    // change would issue a redundant /me call and risk a transient 401 race
    // that bounces the user back to the login page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // A local redirect is still the right result if the cookie was already gone.
    }
    toast.info("已退出登录")
    window.location.assign(`/login?next=${encodeURIComponent("/")}`)
  }, [])

  const value = useMemo(() => ({ enabled, user, logout }), [enabled, user, logout])

  if (!enabled) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  }

  if (checking) {
    return <AuthLoading />
  }

  if (!user || isLoginRoute) {
    return <LoginPage onAuthenticated={setUser} initialMessage={loginMessage} />
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
