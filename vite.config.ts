import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useProxy = env.VITE_USE_PROXY === "true";
  const transcribeUrl = env.VITE_N8N_TRANSCRIBE_URL || "";
  const summaryUrl = env.VITE_N8N_SUMMARY_URL || "";
  const headers = env.VITE_N8N_API_KEY ? { Authorization: `Bearer ${env.VITE_N8N_API_KEY}` } : undefined;

  const proxy: Record<string, unknown> | undefined = useProxy
    ? {
        ...(transcribeUrl
          ? {
              "/api/n8n/transcribe": {
                target: transcribeUrl,
                changeOrigin: true,
                secure: false,
                rewrite: (p: string) => p.replace(/^\/api\/n8n\/transcribe/, ""),
                headers,
              },
            }
          : {}),
        ...(summaryUrl
          ? {
              "/api/n8n/summary": {
                target: summaryUrl,
                changeOrigin: true,
                secure: false,
                rewrite: (p: string) => p.replace(/^\/api\/n8n\/summary/, ""),
                headers,
              },
            }
          : {}),
      }
    : undefined;

  return {
    plugins: [react()],
    server: { proxy },
    test: {
      environment: "jsdom",
      setupFiles: ["tests/setup.ts"],
      coverage: { provider: "v8", reporter: ["text", "html"] },
    },
  };
});
