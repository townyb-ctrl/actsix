import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // React, Supabase and the Radix/icon layer change far less often than
        // our own screens. Splitting them off keeps a shipped app update from
        // invalidating ~450 kB of library code in everyone's browser cache.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;

          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return "vendor-react";
          }
          if (id.includes("node_modules/@tanstack/")) return "vendor-react";
          if (id.includes("node_modules/@supabase/")) return "vendor-supabase";

          // The shared shell every screen renders: Radix primitives, icons,
          // toasts, drawers. Eager either way, but split so a screen-only
          // change does not re-download it.
          if (
            id.includes("node_modules/@radix-ui/") ||
            id.includes("node_modules/lucide-react/") ||
            id.includes("node_modules/sonner/") ||
            id.includes("node_modules/vaul/") ||
            id.includes("node_modules/cmdk/")
          ) {
            return "vendor-ui";
          }

          if (id.includes("node_modules/@dnd-kit/")) return "vendor-dnd";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
