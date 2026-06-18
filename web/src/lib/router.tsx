import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react"

/**
 * Tiny dependency-free router. The app is a single-variant Studio at "/"; we only
 * need a handful of extra top-level routes (/gallery, /gallery/:slug, /share/:slug),
 * so a full router library would be overkill. Uses the History API + a popstate
 * listener; the backend serves index.html for these paths (see app.py SPA shell).
 */

export function navigate(to: string, replace = false): void {
  if (to === window.location.pathname + window.location.search) return
  if (replace) window.history.replaceState({}, "", to)
  else window.history.pushState({}, "", to)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  return path
}

/** Returns the trailing segment for a `/<prefix>/<segment>` path, else "". */
export function segmentAfter(path: string, prefix: string): string {
  if (!path.startsWith(prefix)) return ""
  const rest = path.slice(prefix.length).replace(/^\/+/, "")
  return rest.split("/")[0] ?? ""
}

export function Link({
  to,
  onClick,
  ...rest
}: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    // Respect modifier-clicks / new-tab intent.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return
    }
    e.preventDefault()
    navigate(to)
    onClick?.(e)
  }
  return <a href={to} onClick={handle} {...rest} />
}
