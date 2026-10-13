import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { viteSingleFile } from "vite-plugin-singlefile"

// Single-file build: the whole app (JS + CSS) is inlined into dist/index.html,
// so it can be hosted anywhere, including as a claude.ai artifact.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  base: '/diet/'
})
