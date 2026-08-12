import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  // livekit-client (dépendance de @elevenlabs/react) référence process/global,
  // absents par défaut dans un bundle navigateur via Vite.
  define: {
    global: "globalThis",
    "process.env": {},
  },
});
