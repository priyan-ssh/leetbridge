import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/extension.ts"),
      formats: ["cjs"],
      fileName: () => "extension.js"
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "node20",
    minify: false,
    rollupOptions: {
      external: ["vscode"],
      output: {
        exports: "named"
      }
    }
  }
});
