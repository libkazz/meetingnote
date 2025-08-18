import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Prefer TRANSCRIBE_URL; fallback to deprecated API_URL for backward compatibility
  const targetUrl = env.VITE_N8N_TRANSCRIBE_URL || env.VITE_N8N_API_URL || "";
  const useProxy = env.VITE_USE_PROXY === "true" && !!targetUrl;
  return {
    plugins: [react()],
    server: {
      proxy: useProxy
        ? {
            "/api/n8n": {
              target: targetUrl,
              changeOrigin: true,
              secure: false,
              rewrite: (p) => p.replace(/^\/api\/n8n/, ""),
              headers: env.VITE_N8N_API_KEY
                ? { Authorization: `Bearer ${env.VITE_N8N_API_KEY}` }
                : undefined,
            },
          }
        : undefined,
    },
    test: {
      environment: "jsdom",
      setupFiles: ["tests/setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
      },
    },
  };
});
