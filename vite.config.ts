import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "use-sync-external-store/shim",
      "use-sync-external-store/shim/with-selector",
    ],
  },
  build: { target: "es2022" },
});
