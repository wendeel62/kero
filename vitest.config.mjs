import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  cacheDir: ".vitest-cache", // repo-local (sandboxes restringem /tmp)
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    // os testes batem no MESMO Supabase remoto (free tier): em paralelo gera
    // timeouts intermitentes; com isolate:false + sequencial, os vi.mock de
    // supabase/server vazam entre arquivos no mesmo worker (401s). Padrão:
    // isolado por arquivo + sequencial = estável.
    fileParallelism: false,
    // remaining residual: um pico de latência do remoto gratuito pode estourar
    // o timeout do teste (visto ~1 em 5 runs); retry:1 cobre. Se um teste
    // real quebrar, falha nas 2 tentativas — o retry não mascara regressões.
    retry: 1,
    exclude: ["**/node_modules/**", "**/tests/e2e/**", "**/.next/**", "**/dist/**"],
  },
});
