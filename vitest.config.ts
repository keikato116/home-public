import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The app runs on devices in JST; date parsing of timezone-less strings
    // (local calendar events) depends on the runtime timezone.
    env: { TZ: "Asia/Tokyo" },
  },
});
