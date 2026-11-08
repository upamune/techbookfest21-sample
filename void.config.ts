import { defineConfig } from "void/config";
export default defineConfig({
  routing: { typedRoutes: true },
  head: {
    link: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  },
  worker: { compatibility_date: "2026-11-06" },
});
