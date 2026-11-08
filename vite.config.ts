import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";

export default defineConfig(({ mode }) => ({
  plugins:
    mode === "test" ? [] : [voidPlugin(), voidReact({ react: { compiler: true } }), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 5273, strictPort: true },
  preview: { host: "127.0.0.1", port: 4273, strictPort: true },
  lint: {
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: [
      ".void/**",
      "dist/**",
      "test-results/**",
      "playwright-report/**",
      ".tools/**",
      ".agents/**",
    ],
  },
  fmt: {
    ignorePatterns: [
      ".void/**",
      "dist/**",
      "test-results/**",
      "playwright-report/**",
      ".tools/**",
      ".agents/**",
    ],
  },
  test: {
    include: [
      "src/**/*.test.ts",
      "apps/**/*.test.ts",
      "packages/**/*.test.ts",
      "tests/cli*.test.ts",
    ],
  },
}));
