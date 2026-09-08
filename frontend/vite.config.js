import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api → local Worker (`cd backend && npm run dev` on :8787) so the
// frontend can run without VITE_API_BASE_URL during local development.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
