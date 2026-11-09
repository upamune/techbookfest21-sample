import { defineConfig } from "void/config";
export default defineConfig({
  routing: { typedRoutes: true },
  head: {
    title: "Pocket",
    htmlAttrs: { lang: "ja" },
    meta: [
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { name: "theme-color", content: "#ffffff" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Pocket" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    ],
    script: [
      {
        innerHTML:
          'try{if(localStorage.getItem("pocket-sidebar")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch{}',
      },
    ],
    link: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  },
  worker: { compatibility_date: "2026-11-06" },
  inference: { bindings: { ai: process.env.POCKET_WORKERS_AI !== "off" } },
});
