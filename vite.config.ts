import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { HttpsProxyAgent } from "https-proxy-agent"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // "" prefix → also read non-VITE_ vars (server-only, never bundled for the browser)
  const env = loadEnv(mode, __dirname, "")
  const llmTarget = env.LLM_PROXY_TARGET
  // Jupiter (and other blocked hosts) egress via a local proxy when set.
  const localProxy = env.LOCAL_HTTPS_PROXY
  const proxyAgent = localProxy ? new HttpsProxyAgent(localProxy) : undefined

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Dev-only CORS/egress fix: browser calls same-origin /llm/* and /jup/*,
    // Vite forwards to the real endpoints (docs/plainwords-plan.md §9 risk plan).
    server: {
      proxy: {
        ...(llmTarget
          ? {
              "/llm": {
                target: llmTarget,
                changeOrigin: true,
                rewrite: (p) => p.replace(/^\/llm/, ""),
              },
            }
          : {}),
        "/jup": {
          target: env.JUP_PROXY_TARGET || "https://lite-api.jup.ag",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/jup/, ""),
          agent: proxyAgent,
        },
      },
    },
  }
})
