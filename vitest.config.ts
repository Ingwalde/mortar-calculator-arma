import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@core": resolve(__dirname, "src/core")
    }
  },
  test: {
    environment: "node",
    include: ["src/core/**/*.test.ts", "src/main/**/*.test.ts", "src/renderer/**/*.test.ts", "test/**/*.test.ts"]
  }
});
