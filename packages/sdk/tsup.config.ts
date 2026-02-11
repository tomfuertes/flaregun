import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    outDir: "dist",
    clean: true,
    dts: true,
    minify: true,
    treeshake: true,
    outExtension({ format }) {
      return { js: format === "esm" ? ".mjs" : ".js" };
    },
  },
  {
    entry: ["src/index.ts"],
    format: ["iife"],
    globalName: "Flaregun",
    outDir: "dist",
    minify: true,
    treeshake: true,
    outExtension() {
      return { js: ".iife.js" };
    },
  },
]);
