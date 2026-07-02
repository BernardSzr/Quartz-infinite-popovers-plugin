import { defineConfig } from "tsup"
import fs from "fs"
import path from "path"
import esbuild from "esbuild"

// esbuild plugin to handle ?raw imports
// For .ts/.tsx files: bundle all imports, then return as text string
// For other files: return raw text
const rawPlugin = {
  name: "raw",
  setup(build: any) {
    build.onResolve({ filter: /\?raw$/ }, (args: any) => {
      const rawPath = args.path.replace(/\?raw$/, "")
      const candidates = [rawPath, rawPath + ".ts", rawPath + ".tsx", rawPath + ".js", rawPath + ".css", rawPath + ".txt"]
      for (const candidate of candidates) {
        const resolved = path.resolve(args.resolveDir, candidate)
        if (fs.existsSync(resolved)) {
          return { path: resolved, namespace: "raw-ns" }
        }
      }
      return { path: path.resolve(args.resolveDir, rawPath), namespace: "raw-ns" }
    })
    build.onLoad({ filter: /.*/, namespace: "raw-ns" }, async (args: any) => {
      const contents = await fs.promises.readFile(args.path, "utf8")
      const ext = path.extname(args.path)
      if (ext === ".ts" || ext === ".tsx") {
        const result = await esbuild.build({
          entryPoints: [args.path],
          bundle: true,
          write: false,
          format: "esm",
          target: "es2020",
          loader: { ".ts": "ts", ".tsx": "tsx" },
          external: [],
        })
        const output = result.outputFiles?.[0]
        if (output) {
          const code = output.text
            .replace(/^export\s+\{[^}]*\};?\s*$/gm, "")
            .replace(/^export\s+default\s+/gm, "")
          return { contents: code, loader: "text" }
        }
      }
      return { contents, loader: "text" }
    })
  },
}

export default defineConfig({
  entry: ["src/index.ts", "src/components/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  minify: false,
  esbuildPlugins: [rawPlugin],
  noExternal: [/.*/],
  external: [
    "preact",
    "preact/render",
    "preact/hooks",
    "preact/jsx-runtime",
    "preact/compat",
  ],
})
