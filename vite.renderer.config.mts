import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  root: resolve("src/renderer"),
  base: "./",
  build: {
    outDir: resolve(".vite/renderer/main_window"),
  },
  resolve: {
    alias: {
      "@": resolve("src/renderer/src"),
    },
  },
  plugins: [react(), tailwindcss()],
})