import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
          "engine-host": resolve(__dirname, "src/engine-host/index.ts"),
        },
      },
    },
  },
  preload: {
    ssr: { noExternal: true },
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/preload/index.ts"),
        external: (id) => id === "electron" || id.startsWith("electron/") || id.startsWith("node:"),
        output: { format: "cjs", entryFileNames: "[name].cjs", chunkFileNames: "[name]-[hash].cjs" },
      },
    },
  },
  renderer: {
    resolve: { alias: { "@": resolve(__dirname, "src/renderer") } },
    root: resolve(__dirname, "src/renderer"),
    build: { rollupOptions: { input: resolve(__dirname, "src/renderer/index.html") } },
  },
});
