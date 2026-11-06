import { defineConfig } from "vite";

export default defineConfig({
  // Chemins relatifs : le dossier dist/ peut être ouvert depuis n'importe quel
  // sous-répertoire (GitHub Pages, serveur interne, etc.).
  base: "./",
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
  },
});
