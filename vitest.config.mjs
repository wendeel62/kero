import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  cacheDir: ".vitest-cache", // repo-local (sandboxes restringem /tmp)
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: false, // reusa workers (mais rápido)
    exclude: ["**/node_modules/**", "**/tests/e2e/**", "**/.next/**", "**/dist/**"],
  },
});
