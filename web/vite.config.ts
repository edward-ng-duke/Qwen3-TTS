import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const target = env.VITE_PROXY_TARGET || "http://localhost:4967"
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      port: 5173,
      // Accept any Host header (ngrok / tailscale / LAN IP). Dev-only — the
      // production runtime is the FastAPI container, not Vite.
      allowedHosts: true,
      cors: true,
      proxy: {
        "/v1": { target, changeOrigin: true },
        "/api": { target, changeOrigin: true },
        "/docs": { target, changeOrigin: true },
        "/openapi.json": { target, changeOrigin: true },
      },
    },
  }
})
